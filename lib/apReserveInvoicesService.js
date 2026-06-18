import mongoose from 'mongoose';
import '@/models/index.js';
import APReserveInvoice from '@/models/APReserveInvoice.js';
import PurchaseOrder from '@/models/PurchaseOrder.js';
import { connectDB } from '@/lib/mongodb';
import { buildPagination } from '@/lib/errors';
import { APRI_SORT_FIELDS, resolveSortField } from '@/lib/listQuery.js';
import { nextNumber } from '@/lib/numbering.js';
import { logApprovalHistory } from '@/lib/auditHistory.js';
import {
  getApprovalSteps,
  getCurrentStep,
  getInitialSubmitState,
  getStateAfterApproval,
} from '@/lib/approvalEngine.js';
import { loadApriWorkflow } from '@/lib/workflowSteps.js';
import { assertUserCanApproveDocument, buildDocumentApprovalAccess } from '@/lib/documentApprovalAuth.js';
import { assertImplementedCompletionPolicy } from '@/lib/approvalPolicies.js';
import {
  assertApprovalVersionMatches,
  atomicDocumentStepTransition,
  buildAtomicStepFilter,
  logStepApprovalHistory,
  rejectedStatusForDocumentType,
} from '@/lib/approvalTransition.js';
import { getEffectivePermissions } from '@/lib/effectivePermissions.js';
import { buildApriLinesFromPo } from '@/lib/sap/mappers/apReserveInvoiceToSap.js';
import { createSapApReserveInvoice, retrySapApReserveInvoice } from '@/lib/sap/apriSap.js';
import { filterPosReadyForApri } from '@/lib/poApriReadiness.js';
import { sanitizePo } from '@/lib/purchaseOrdersService.js';
import { isUsdPoCurrency, normalizePoDocCurrency } from '@/lib/poCurrency.js';
import {
  resolveDefaultPoDocCurrency,
  resolveDefaultPoDocRate,
} from '@/lib/sap/sapPoConfig.js';
import { PO_STATUS, poStatusInQuery, poStatusesEqual } from '@/lib/poStatus.js';
import {
  buildApriListAccessFilter,
  userCanAccessApriWorkflow,
  userCanViewApriDocument,
} from '@/lib/apriPermissions.js';
import { buildApprovalActionResult } from '@/lib/approvalActionResponse.js';
import { APRI_LIST_SELECT, lineCount } from '@/lib/listFields.js';
import { perfAsync } from '@/lib/perfLog.js';
import { traceMark } from '@/lib/requestTrace.js';

const DOC_TYPE = 'APRI';

export function sanitizeApri(doc) {
  if (!doc) return null;
  const id = doc._id?.toString() || doc.id;
  return {
    id,
    portalAPNumber: doc.portalAPNumber,
    relatedPOId: doc.relatedPOId?._id?.toString() || doc.relatedPOId?.toString(),
    relatedPONumber: doc.relatedPONumber,
    relatedSAPPODocEntry: doc.relatedSAPPODocEntry,
    relatedSAPPODocNum: doc.relatedSAPPODocNum,
    vendor: doc.vendor,
    postingDate: doc.postingDate,
    documentDate: doc.documentDate,
    dueDate: doc.dueDate,
    taxDate: doc.taxDate,
    docCurrency: doc.docCurrency,
    docRate: doc.docRate,
    remarks: doc.remarks,
    status: doc.status,
    currentApprovalStep: doc.currentApprovalStep,
    sapAPDocEntry: doc.sapAPDocEntry,
    sapAPDocNum: doc.sapAPDocNum,
    sapCreationStatus: doc.sapCreationStatus,
    sapErrorMessage: doc.sapErrorMessage,
    lines: doc.lines || [],
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    __v: doc.__v,
  };
}

export function sanitizeApriListItem(doc) {
  const base = sanitizeApri(doc);
  if (!base) return null;
  const { lines, ...rest } = base;
  return { ...rest, lineCount: lineCount(doc) };
}

function applyApriSearchFilters(filter, searchParams) {
  const portalAPNumber = searchParams.get('portalAPNumber');
  if (portalAPNumber) filter.portalAPNumber = { $regex: portalAPNumber, $options: 'i' };
  const relatedPONumber = searchParams.get('relatedPONumber');
  if (relatedPONumber) filter.relatedPONumber = { $regex: relatedPONumber, $options: 'i' };
  const sapAPDocNum = searchParams.get('sapAPDocNum');
  if (sapAPDocNum) filter.sapAPDocNum = { $regex: sapAPDocNum, $options: 'i' };
  const vendor = searchParams.get('vendor');
  if (vendor) filter.vendor = { $regex: vendor, $options: 'i' };
  const status = searchParams.get('status');
  if (status) filter.status = status;
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }
  const q = searchParams.get('q')?.trim();
  if (q) {
    const qFilter = {
      $or: [
        { portalAPNumber: { $regex: q, $options: 'i' } },
        { relatedPONumber: { $regex: q, $options: 'i' } },
        { sapAPDocNum: { $regex: q, $options: 'i' } },
        { vendor: { $regex: q, $options: 'i' } },
      ],
    };
    if (Object.keys(filter).length) {
      return { $and: [filter, qFilter] };
    }
    return qFilter;
  }
  return filter;
}

async function buildListFilter(user, { searchParams }, steps) {
  const accessFilter = await buildApriListAccessFilter(user, steps);
  const searchFilter = applyApriSearchFilters({}, searchParams);
  if (!Object.keys(accessFilter).length) return searchFilter;
  if (!Object.keys(searchFilter).length) return accessFilter;
  return { $and: [accessFilter, searchFilter] };
}

export async function listApReserveInvoices(user, { page, limit, sort, order, searchParams }) {
  return perfAsync('listApReserveInvoices', async () => {
    await connectDB();
    const steps = await getApprovalSteps('APRI');
    if (!(await userCanAccessApriWorkflow(user, steps))) {
      const err = new Error('Forbidden');
      err.code = 'FORBIDDEN';
      throw err;
    }
    const filter = await buildListFilter(user, { searchParams }, steps);
    const sortDir = order === 'asc' ? 1 : -1;
    const sortField = resolveSortField(sort, APRI_SORT_FIELDS);

    const [total, rows] = await Promise.all([
      APReserveInvoice.countDocuments(filter),
      APReserveInvoice.find(filter)
        .select(APRI_LIST_SELECT)
        .sort({ [sortField]: sortDir })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    return {
      items: rows.map(sanitizeApriListItem),
      pagination: buildPagination(page, limit, total),
    };
  });
}

export async function fetchApReserveInvoicesForExport(user, { searchParams, sort, order, limit }) {
  await connectDB();
  if (!(await userCanAccessApriWorkflow(user))) {
    const err = new Error('Forbidden');
    err.code = 'FORBIDDEN';
    throw err;
  }
  const filter = await buildListFilter(user, { searchParams });
  const sortDir = order === 'asc' ? 1 : -1;
  const sortField = resolveSortField(sort, APRI_SORT_FIELDS);
  const rows = await APReserveInvoice.find(filter)
    .sort({ [sortField]: sortDir })
    .limit(limit)
    .lean();
  return rows.map(sanitizeApri);
}

export async function findApriByPoId(poId) {
  return APReserveInvoice.findOne({ relatedPOId: poId }).lean();
}

export async function listPosReadyForApri(user, { page, limit }) {
  return perfAsync('listPosReadyForApri', async () => {
    await connectDB();
    traceMark('db');

    const baseFilter = {
      status: poStatusInQuery(PO_STATUS.CREATED_IN_SAP),
      sapPODocEntry: { $exists: true, $ne: null },
    };

    const permissions = getEffectivePermissions(user);
    if (!permissions.includes('view.all') && !permissions.includes('apinvoice.create')) {
      baseFilter.requester = user._id;
    }

    const occupiedPoIds = await APReserveInvoice.distinct('relatedPOId');
    traceMark('matrix');

    const filter =
      occupiedPoIds.length > 0
        ? { ...baseFilter, _id: { $nin: occupiedPoIds } }
        : baseFilter;

    const [total, rows] = await Promise.all([
      PurchaseOrder.countDocuments(filter),
      PurchaseOrder.find(filter)
        .select('portalPONumber sapPODocNum sapPODocEntry vendor status createdAt')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);
    traceMark('query');

    return {
      items: rows.map((row) => ({
        id: row._id.toString(),
        portalPONumber: row.portalPONumber,
        sapPODocNum: row.sapPODocNum,
        sapPODocEntry: row.sapPODocEntry,
        vendor: row.vendor,
        status: row.status,
        createdAt: row.createdAt,
      })),
      pagination: buildPagination(page, limit, total),
    };
  });
}

export async function getApReserveInvoiceById(id, user) {
  return perfAsync(`getApReserveInvoiceById ${id}`, async () => {
    await connectDB();
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    const steps = await getApprovalSteps('APRI');
    if (!(await userCanAccessApriWorkflow(user, steps))) {
      const err = new Error('Forbidden');
      err.code = 'FORBIDDEN';
      throw err;
    }

    const apri = await APReserveInvoice.findById(id).lean();
    if (!apri) return null;
    if (!(await userCanViewApriDocument(user, apri, steps))) {
      const err = new Error('Forbidden');
      err.code = 'FORBIDDEN';
      throw err;
    }

    const relatedPo = await PurchaseOrder.findById(apri.relatedPOId)
      .select('portalPONumber status sapPODocNum')
      .lean();

    const workflowSteps = await loadApriWorkflow(apri, user, steps);
    const permissions = getEffectivePermissions(user);
    const canEdit =
      (permissions.includes('apinvoice.create') || permissions.includes('view.all')) &&
      ['Rejected', 'Pending Warehouse Approval'].includes(apri.status) &&
      !apri.sapAPDocEntry;

    const approvalAccess = buildDocumentApprovalAccess({
      documentType: 'APRI',
      document: sanitizeApri(apri),
      user,
      approvalSteps: steps,
    });

    return {
      ...sanitizeApri(apri),
      workflowSteps,
      ...approvalAccess,
      canEdit,
      relatedPO: relatedPo
        ? {
            id: relatedPo._id.toString(),
            portalPONumber: relatedPo.portalPONumber,
            status: relatedPo.status,
            sapPODocNum: relatedPo.sapPODocNum,
          }
        : null,
    };
  });
}

export async function createApriFromPo(poId, user) {
  await connectDB();
  const po = await PurchaseOrder.findById(poId).lean();
  if (!po) return { error: 'NOT_FOUND' };

  if (!poStatusesEqual(po.status, PO_STATUS.CREATED_IN_SAP)) {
    return { error: 'INVALID_STATUS', message: 'Purchase order must be Created in SAP' };
  }
  if (po.sapPODocEntry == null) {
    return { error: 'NO_SAP_PO', message: 'Purchase order has no SAP DocEntry' };
  }

  const existing = await findApriByPoId(poId);
  if (existing) {
    if (existing.sapAPDocEntry || existing.status === 'Created in SAP') {
      return {
        error: 'DUPLICATE_APRI',
        message: 'An A/P Reserve Invoice already exists for this purchase order',
        apriId: existing._id.toString(),
      };
    }
    if (existing.status === 'Creating in SAP') {
      return { error: 'DUPLICATE_APRI', message: 'APRI creation already in progress' };
    }
    if (existing.status === 'Failed to Create in SAP') {
      return {
        error: 'APRI_EXISTS_FAILED',
        message: 'A failed APRI exists — use retry on the APRI record',
        apriId: existing._id.toString(),
      };
    }
    if (existing.status === 'Rejected' || existing.status === 'Pending Warehouse Approval') {
      return {
        error: 'APRI_EXISTS_DRAFT',
        message: 'An APRI already exists for this PO — edit or resubmit it',
        apriId: existing._id.toString(),
      };
    }
  }

  const apriLines = buildApriLinesFromPo(po);
  if (!apriLines.length) {
    return {
      error: 'INVALID_LINES',
      message: 'No PO lines with valid SAP base references (LineNum) found',
    };
  }

  const portalAPNumber = await nextNumber('APRI');
  const documentDate = po.documentDate || po.postingDate || new Date();
  const dueDate = po.requiredDate || po.documentDate || new Date();
  const taxDate = documentDate;
  const docCurrency = normalizePoDocCurrency(po.docCurrency, resolveDefaultPoDocCurrency());
  const rawRate = isUsdPoCurrency(docCurrency)
    ? (po.docRate ?? resolveDefaultPoDocRate())
    : undefined;
  const docRate = rawRate != null ? Number(rawRate) : undefined;

  const steps = await getApprovalSteps('APRI');
  const initial = getInitialSubmitState(steps, 'APRI');

  const apriDoc = await APReserveInvoice.create({
    portalAPNumber,
    relatedPOId: po._id,
    relatedPONumber: po.portalPONumber,
    relatedSAPPODocEntry: po.sapPODocEntry,
    relatedSAPPODocNum: po.sapPODocNum,
    vendor: po.vendor,
    postingDate: po.postingDate,
    documentDate,
    dueDate,
    taxDate,
    docCurrency,
    ...(Number.isFinite(docRate) && docRate > 0 ? { docRate } : {}),
    remarks: po.remarks,
    status: initial.status,
    currentApprovalStep: initial.currentApprovalStep,
    createdBy: user._id || user.id,
    lines: apriLines,
  });

  await logApprovalHistory({
    documentType: DOC_TYPE,
    documentId: apriDoc._id,
    stepName: 'Creation',
    action: 'Submitted',
    actionBy: user,
    actionByRole: user.roleName,
    comment: `Created from PO ${po.portalPONumber}`,
    previousStatus: null,
    newStatus: initial.status,
  });

  const refreshed = await APReserveInvoice.findById(apriDoc._id).lean();

  return {
    apri: sanitizeApri(refreshed),
    sapResult: null,
  };
}

async function loadApriForUpdate(id) {
  await connectDB();
  const apri = await APReserveInvoice.findById(id);
  if (!apri) {
    const err = new Error('A/P Reserve Invoice not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  return apri;
}

export async function updateApriQuantities(id, data, user) {
  const apri = await loadApriForUpdate(id);
  const permissions = getEffectivePermissions(user);
  if (!permissions.includes('apinvoice.create') && !permissions.includes('view.all')) {
    const err = new Error('Forbidden');
    err.code = 'FORBIDDEN';
    throw err;
  }
  if (!['Rejected', 'Pending Warehouse Approval'].includes(apri.status) || apri.sapAPDocEntry) {
    const err = new Error('Only pending or rejected APRI records can be edited');
    err.code = 'INVALID_STATUS';
    throw err;
  }
  if (data.__v != null && data.__v !== apri.__v) {
    const err = new Error('Document changed');
    err.code = 'VERSION_CONFLICT';
    throw err;
  }
  if (!data.lines?.length) {
    const err = new Error('At least one line is required');
    err.code = 'VALIDATION';
    throw err;
  }
  for (const line of data.lines) {
    const existing = line._id ? apri.lines.id(line._id) : null;
    if (!existing) continue;
    const qty = Number(line.quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      const err = new Error('Quantity must be positive');
      err.code = 'VALIDATION';
      throw err;
    }
    existing.quantity = qty;
    if (existing.unitPrice != null) {
      existing.lineTotal = existing.unitPrice * qty;
    }
  }
  apri.markModified('lines');
  await apri.save();
  return sanitizeApri(apri.toObject());
}

export async function resubmitApri(id, user, { __v } = {}) {
  const apri = await loadApriForUpdate(id);
  const permissions = getEffectivePermissions(user);
  if (!permissions.includes('apinvoice.create') && !permissions.includes('view.all')) {
    const err = new Error('Forbidden');
    err.code = 'FORBIDDEN';
    throw err;
  }
  if (apri.status !== 'Rejected') {
    const err = new Error('Only rejected APRI records can be resubmitted');
    err.code = 'INVALID_STATUS';
    throw err;
  }
  if (__v != null && __v !== apri.__v) {
    const err = new Error('Document changed');
    err.code = 'VERSION_CONFLICT';
    throw err;
  }
  const steps = await getApprovalSteps('APRI');
  const next = getInitialSubmitState(steps, 'APRI');
  const previousStatus = apri.status;
  apri.status = next.status;
  apri.currentApprovalStep = next.currentApprovalStep;
  await apri.save();

  await logApprovalHistory({
    documentType: DOC_TYPE,
    documentId: apri._id,
    stepName: 'Resubmit',
    action: 'Submitted',
    actionBy: user,
    actionByRole: user.roleName,
    previousStatus,
    newStatus: apri.status,
  });

  return sanitizeApri(apri.toObject());
}

export async function approveApri(id, user, { comment, __v } = {}) {
  const apri = await loadApriForUpdate(id);
  const steps = await getApprovalSteps('APRI');
  const step = getCurrentStep(steps, apri.currentApprovalStep);
  if (!step) {
    const err = new Error('No pending approval step');
    err.code = 'INVALID_STATUS';
    throw err;
  }
  assertUserCanApproveDocument({
    documentType: 'APRI',
    document: apri.toObject(),
    user,
    approvalSteps: steps,
    step,
    action: 'approve',
  });
  assertImplementedCompletionPolicy(step);
  assertApprovalVersionMatches(apri, __v);

  const previousStatus = apri.status;
  const after = getStateAfterApproval(steps, apri.currentApprovalStep, 'APRI');

  const updated = await atomicDocumentStepTransition(
    APReserveInvoice,
    buildAtomicStepFilter(apri, __v),
    {
      status: after.status,
      currentApprovalStep: after.currentApprovalStep,
    },
  );

  await logStepApprovalHistory({
    documentType: DOC_TYPE,
    documentId: apri._id,
    step,
    action: 'Approved',
    user,
    comment,
    previousStatus,
    newStatus: after.status,
  });

  if (after.isFinal) {
    const sapResult = await createSapApReserveInvoice(updated._id.toString(), user);
    const refreshed = await APReserveInvoice.findById(id).lean();
    return buildApprovalActionResult('APRI', sanitizeApri(refreshed), user, {
      message: 'Approved successfully',
      sapResult,
    });
  }

  return buildApprovalActionResult('APRI', sanitizeApri(updated.toObject()), user, {
    message: 'Approved successfully',
    sapResult: null,
  });
}

export async function rejectApri(id, user, { comment, __v } = {}) {
  const apri = await loadApriForUpdate(id);
  const steps = await getApprovalSteps('APRI');
  const step = getCurrentStep(steps, apri.currentApprovalStep);
  if (!step) {
    const err = new Error('No pending approval step');
    err.code = 'INVALID_STATUS';
    throw err;
  }
  assertUserCanApproveDocument({
    documentType: 'APRI',
    document: apri.toObject(),
    user,
    approvalSteps: steps,
    step,
    action: 'reject',
  });
  assertImplementedCompletionPolicy(step);
  assertApprovalVersionMatches(apri, __v);

  const previousStatus = apri.status;
  const rejectedStatus = rejectedStatusForDocumentType('APRI');

  const updated = await atomicDocumentStepTransition(
    APReserveInvoice,
    buildAtomicStepFilter(apri, __v),
    {
      status: rejectedStatus,
      currentApprovalStep: 0,
    },
  );

  await logStepApprovalHistory({
    documentType: DOC_TYPE,
    documentId: apri._id,
    step,
    action: 'Rejected',
    user,
    comment,
    previousStatus,
    newStatus: rejectedStatus,
  });

  return buildApprovalActionResult('APRI', sanitizeApri(updated.toObject()), user, {
    message: 'Rejected successfully',
    sapResult: null,
  });
}

export async function retryApriSap(id, user) {
  const sapResult = await retrySapApReserveInvoice(id, user);
  const refreshed = await APReserveInvoice.findById(id).lean();
  return { apri: sanitizeApri(refreshed), sapResult };
}
