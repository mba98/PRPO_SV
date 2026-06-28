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
  APPROVAL_STEP_ALREADY_COMPLETED,
} from '@/lib/approvalTransition.js';
import { getEffectivePermissions, userHasEffectivePermission } from '@/lib/effectivePermissions.js';
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
  APRI_STATUS,
  apriStatusInQuery,
  apriStatusesEqual,
  isApriFailedSap,
  isApriReturnedToProcurement,
  isApriSapInProgress,
  isApriCreatedInSap,
  isPendingApriWarehouseStatus,
  normalizeApriStatus,
} from '@/lib/apriStatus.js';
import { validateApriQuantityUpdates } from '@/lib/apriQuantityValidation.js';
import {
  enrichApriLines,
  loadPoWithLines,
  loadUsedQuantitiesByPoLine,
} from '@/lib/apriLineQuantityLimits.js';
import { invalidateApriWorkflowCaches } from '@/lib/apriCache.js';
import { notifyWorkflowEmailSafe } from '@/lib/emailNotify.js';
import { buildApriEmailContext } from '@/lib/emailContext.js';
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

export const APRI_ALREADY_CREATING_OR_CREATED = 'APRI_ALREADY_CREATING_OR_CREATED';

function createApriSapConflictError() {
  const err = new Error(
    'This A/P Reserve Invoice is already being created or has already been created in SAP.',
  );
  err.code = APRI_ALREADY_CREATING_OR_CREATED;
  return err;
}

import {
  resolveApriSapCreationAccess,
  userCanCreateApriInSap,
  userCanPerformApriSapAction,
  userIsApriOwner,
} from '@/lib/apriSapAuthorization.js';

export {
  userCanCreateApriInSap,
  userCanPerformApriSapAction,
  userIsApriOwner,
} from '@/lib/apriSapAuthorization.js';

export function userCanRetryApriSap(user, apri) {
  if (!userCanPerformApriSapAction(user, apri)) {
    return false;
  }
  if (!isApriFailedSap(apri.status)) return false;
  if (apri.sapAPDocEntry) return false;
  return true;
}

export function userCanEditApriQuantities(user, apri) {
  if (!userHasEffectivePermission(user, 'apri.edit') && !userHasEffectivePermission(user, 'apri.create')) {
    return false;
  }
  if (!userIsApriOwner(user, apri)) {
    return false;
  }
  if (apri.sapAPDocEntry) return false;
  return apriStatusesEqual(apri.status, APRI_STATUS.WAREHOUSE_REJECTED);
}

export function sanitizeApri(doc) {
  if (!doc) return null;
  const id = doc._id?.toString() || doc.id;
  const lines = (doc.lines || []).map((line) => ({
    ...line,
    _id: line._id?.toString() || line.id,
  }));
  const documentTotal = lines.reduce((sum, line) => {
    const total = Number(line.lineTotal);
    return sum + (Number.isFinite(total) ? total : 0);
  }, 0);
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
    lines,
    documentTotal,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    __v: doc.__v,
  };
}

async function buildApriDetailPayload(apriDoc, user, steps) {
  const po = await loadPoWithLines(apriDoc.relatedPOId);
  const usedByPoLine = await loadUsedQuantitiesByPoLine(
    apriDoc.relatedPOId,
    apriDoc._id?.toString() || apriDoc.id,
  );
  const enrichedLines = enrichApriLines(apriDoc, po, usedByPoLine);
  const enrichedApri = { ...apriDoc, lines: enrichedLines };

  const workflowSteps = await loadApriWorkflow(enrichedApri, user, steps);
  const canEdit = userCanEditApriQuantities(user, enrichedApri);
  const sapAccess = resolveApriSapCreationAccess(user, enrichedApri, {
    log: process.env.NODE_ENV !== 'production',
  });
  const canCreateInSap = sapAccess.canCreateInSap;
  const createInSapBlockReason = sapAccess.createInSapBlockReason;
  const canRetrySap = userCanRetryApriSap(user, enrichedApri);

  const approvalAccess = buildDocumentApprovalAccess({
    documentType: 'APRI',
    document: sanitizeApri(enrichedApri),
    user,
    approvalSteps: steps,
  });

  const relatedPo = po
    ? {
        id: po._id.toString(),
        portalPONumber: po.portalPONumber,
        status: po.status,
        sapPODocNum: po.sapPODocNum,
      }
    : null;

  const document = {
    ...sanitizeApri(enrichedApri),
    workflowSteps,
    ...approvalAccess,
    canEdit,
    canCreateInSap,
    createInSapBlockReason,
    canRetrySap,
    canEditQuantities: canEdit,
    relatedPO: relatedPo,
  };

  return {
    document,
    canCreateInSap,
    createInSapBlockReason,
    canEditQuantities: canEdit,
    canRetrySap,
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
  if (status) {
    filter.status = apriStatusInQuery(normalizeApriStatus(status));
  }
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

    const { document } = await buildApriDetailPayload(apri, user, steps);
    return document;
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
    if (existing.sapAPDocEntry || isApriCreatedInSap(existing.status)) {
      return {
        error: 'DUPLICATE_APRI',
        message: 'An A/P Reserve Invoice already exists for this purchase order',
        apriId: existing._id.toString(),
      };
    }
    if (isApriSapInProgress(existing.status)) {
      return { error: 'DUPLICATE_APRI', message: 'APRI creation already in progress' };
    }
    if (isApriFailedSap(existing.status)) {
      return {
        error: 'APRI_EXISTS_FAILED',
        message: 'A failed APRI exists — use retry on the APRI record',
        apriId: existing._id.toString(),
      };
    }
    if (
      isPendingApriWarehouseStatus(existing.status) ||
      isApriReturnedToProcurement(existing.status)
    ) {
      return {
        error: 'APRI_EXISTS_DRAFT',
        message: 'An APRI already exists for this PO — open the existing record',
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
  if (!userCanEditApriQuantities(user, apri)) {
    const err = new Error('Only warehouse-rejected APRI records can have quantities edited');
    err.code = 'FORBIDDEN';
    throw err;
  }
  assertApprovalVersionMatches(apri, data.__v);

  await validateApriQuantityUpdates(apri, data.lines);

  const previousStatus = apri.status;
  for (const line of data.lines) {
    const existing = apri.lines.id(line._id);
    if (!existing) continue;
    const qty = Number(line.quantity);
    existing.quantity = qty;
    if (existing.unitPrice != null) {
      existing.lineTotal = existing.unitPrice * qty;
    }
  }
  apri.markModified('lines');
  await apri.save();

  await logApprovalHistory({
    documentType: DOC_TYPE,
    documentId: apri._id,
    stepName: 'Procurement Update',
    action: 'Updated',
    actionBy: user,
    actionByRole: user.roleName,
    comment: 'Procurement updated quantity',
    previousStatus,
    newStatus: apri.status,
  });

  invalidateApriWorkflowCaches();

  const steps = await getApprovalSteps('APRI');
  const refreshed = await APReserveInvoice.findById(id).lean();
  return buildApriDetailPayload(refreshed, user, steps);
}

export async function resubmitApri(id, user, { __v } = {}) {
  const apri = await loadApriForUpdate(id);
  if (!userHasEffectivePermission(user, 'apri.resubmit') && !userHasEffectivePermission(user, 'apri.create')) {
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

  await logApprovalHistory({
    documentType: DOC_TYPE,
    documentId: apri._id,
    stepName: 'Returned to Procurement',
    action: 'Updated',
    actionBy: user,
    actionByRole: user.roleName,
    comment: 'Warehouse approved — returned to Procurement for SAP creation',
    previousStatus: after.status,
    newStatus: after.status,
  });

  notifyWorkflowEmailSafe(
    'apri.warehouse.approved',
    {
      ...buildApriEmailContext(updated.toObject()),
      status: after.status,
      comment,
    },
    { documentType: DOC_TYPE, documentId: updated._id.toString() },
  );

  invalidateApriWorkflowCaches();

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

  await logApprovalHistory({
    documentType: DOC_TYPE,
    documentId: apri._id,
    stepName: 'Returned to Procurement',
    action: 'Updated',
    actionBy: user,
    actionByRole: user.roleName,
    comment: comment || 'Warehouse rejected — returned to Procurement',
    previousStatus: rejectedStatus,
    newStatus: rejectedStatus,
  });

  notifyWorkflowEmailSafe(
    'apri.warehouse.rejected',
    {
      ...buildApriEmailContext(updated.toObject()),
      status: rejectedStatus,
      comment,
    },
    { documentType: DOC_TYPE, documentId: updated._id.toString() },
  );

  invalidateApriWorkflowCaches();

  return buildApprovalActionResult('APRI', sanitizeApri(updated.toObject()), user, {
    message: 'Rejected successfully',
    sapResult: null,
  });
}

export async function createApriInSap(id, user, { __v } = {}) {
  const apri = await loadApriForUpdate(id);
  if (!userCanCreateApriInSap(user, apri)) {
    const err = new Error('You are not authorized to create this APRI in SAP');
    err.code = 'FORBIDDEN';
    throw err;
  }
  assertApprovalVersionMatches(apri, __v);

  let updated;
  try {
    updated = await atomicDocumentStepTransition(
      APReserveInvoice,
      buildAtomicStepFilter(apri, __v),
      { status: APRI_STATUS.CREATING_IN_SAP },
    );
  } catch (err) {
    if (err.code === APPROVAL_STEP_ALREADY_COMPLETED) {
      throw createApriSapConflictError();
    }
    throw err;
  }

  await logApprovalHistory({
    documentType: DOC_TYPE,
    documentId: apri._id,
    stepName: 'SAP Integration',
    action: 'Submitted',
    actionBy: user,
    actionByRole: user.roleName,
    comment: 'Procurement started SAP creation',
    previousStatus: apri.status,
    newStatus: APRI_STATUS.CREATING_IN_SAP,
  });

  invalidateApriWorkflowCaches();

  const sapResult = await createSapApReserveInvoice(updated._id.toString(), user, {
    skipCreatingStatus: true,
  });

  const refreshed = await APReserveInvoice.findById(id).lean();
  invalidateApriWorkflowCaches();

  if (sapResult?.error === 'DUPLICATE_SAP') {
    return { apri: sanitizeApri(refreshed), sapResult };
  }

  return {
    apri: sanitizeApri(refreshed),
    sapResult,
  };
}

export async function retryApriSap(id, user, { __v } = {}) {
  const apri = await loadApriForUpdate(id);
  if (!userCanRetryApriSap(user, apri)) {
    const err = new Error('Forbidden');
    err.code = 'FORBIDDEN';
    throw err;
  }
  if (!isApriFailedSap(apri.status)) {
    const err = new Error('Only failed APRI records can be retried');
    err.code = 'INVALID_STATUS';
    throw err;
  }
  if (apri.sapAPDocEntry) {
    const err = new Error('SAP document already exists');
    err.code = 'DUPLICATE_SAP';
    throw err;
  }

  assertApprovalVersionMatches(apri, __v ?? apri.__v);

  const previousStatus = apri.status;
  const updated = await atomicDocumentStepTransition(
    APReserveInvoice,
    buildAtomicStepFilter(apri, __v ?? apri.__v),
    { status: APRI_STATUS.CREATING_IN_SAP },
  );

  await logApprovalHistory({
    documentType: DOC_TYPE,
    documentId: apri._id,
    stepName: 'SAP Integration',
    action: 'Submitted',
    actionBy: user,
    actionByRole: user.roleName,
    comment: 'Retry SAP creation',
    previousStatus,
    newStatus: APRI_STATUS.CREATING_IN_SAP,
  });

  invalidateApriWorkflowCaches();

  const sapResult = await createSapApReserveInvoice(updated._id.toString(), user, {
    skipCreatingStatus: true,
  });
  const refreshed = await APReserveInvoice.findById(id).lean();
  invalidateApriWorkflowCaches();
  return { apri: sanitizeApri(refreshed), sapResult };
}
