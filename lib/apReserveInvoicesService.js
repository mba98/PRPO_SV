import mongoose from 'mongoose';
import '@/models/index.js';
import APReserveInvoice from '@/models/APReserveInvoice.js';
import PurchaseOrder from '@/models/PurchaseOrder.js';
import EmailLog from '@/models/EmailLog.js';
import { connectDB } from '@/lib/mongodb';
import { buildPagination } from '@/lib/errors';
import { APRI_SORT_FIELDS, resolveSortField } from '@/lib/listQuery.js';
import { nextNumber } from '@/lib/numbering.js';
import { logApprovalHistory, getApprovalHistory } from '@/lib/auditHistory.js';
import {
  getApprovalSteps,
  getCurrentStep,
  getInitialSubmitState,
  getStateAfterApproval,
  userCanApproveStep,
} from '@/lib/approvalEngine.js';
import { canApproveCurrentWorkflowStep, loadApriWorkflow } from '@/lib/workflowSteps.js';
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

const DOC_TYPE = 'APRI';
const LIST_PERMS = ['apinvoice.create', 'view.all'];

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

function userCanViewApri(user) {
  return user.permissions?.some((p) => LIST_PERMS.includes(p));
}

function buildListFilter(user, { searchParams }) {
  const filter = {};
  if (!user.permissions?.includes('view.all')) {
    filter.createdBy = user._id;
  }
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

export async function listApReserveInvoices(user, { page, limit, sort, order, searchParams }) {
  await connectDB();
  if (!userCanViewApri(user)) {
    const err = new Error('Forbidden');
    err.code = 'FORBIDDEN';
    throw err;
  }
  const filter = buildListFilter(user, { searchParams });
  const sortDir = order === 'asc' ? 1 : -1;
  const sortField = resolveSortField(sort, APRI_SORT_FIELDS);

  const [total, rows] = await Promise.all([
    APReserveInvoice.countDocuments(filter),
    APReserveInvoice.find(filter).sort({ [sortField]: sortDir }).skip((page - 1) * limit).limit(limit).lean(),
  ]);

  return {
    items: rows.map(sanitizeApri),
    pagination: buildPagination(page, limit, total),
  };
}

export async function fetchApReserveInvoicesForExport(user, { searchParams, sort, order, limit }) {
  await connectDB();
  if (!userCanViewApri(user)) {
    const err = new Error('Forbidden');
    err.code = 'FORBIDDEN';
    throw err;
  }
  const filter = buildListFilter(user, { searchParams });
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
  await connectDB();
  const filter = {
    status: poStatusInQuery(PO_STATUS.CREATED_IN_SAP),
    sapPODocEntry: { $exists: true, $ne: null },
  };
  if (!user.permissions?.includes('view.all') && !user.permissions?.includes('apinvoice.create')) {
    filter.requester = user._id;
  }

  const rows = await PurchaseOrder.find(filter)
    .populate('requester', 'name email')
    .sort({ createdAt: -1 })
    .lean();

  const poIds = rows.map((r) => r._id);
  const apris = await APReserveInvoice.find({ relatedPOId: { $in: poIds } }).lean();
  const apriByPo = new Map(apris.map((a) => [a.relatedPOId.toString(), a]));

  const ready = filterPosReadyForApri(rows, apriByPo);
  const total = ready.length;
  const start = (page - 1) * limit;

  return {
    items: ready.slice(start, start + limit).map(sanitizePo),
    pagination: buildPagination(page, limit, total),
  };
}

export async function getApReserveInvoiceById(id, user) {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  if (!userCanViewApri(user)) {
    const err = new Error('Forbidden');
    err.code = 'FORBIDDEN';
    throw err;
  }

  const apri = await APReserveInvoice.findById(id).lean();
  if (!apri) return null;

  const [history, emailLogs, relatedPo] = await Promise.all([
    getApprovalHistory(DOC_TYPE, id),
    EmailLog.find({ relatedDocumentType: DOC_TYPE, relatedDocumentId: apri._id })
      .sort({ sentAt: -1 })
      .lean(),
    PurchaseOrder.findById(apri.relatedPOId).select('portalPONumber status sapPODocNum').lean(),
  ]);

  const workflowSteps = await loadApriWorkflow(apri, user);
  const permissions = getEffectivePermissions(user);
  const canEdit =
    (permissions.includes('apinvoice.create') || permissions.includes('view.all')) &&
    ['Rejected', 'Pending Warehouse Approval'].includes(apri.status) &&
    !apri.sapAPDocEntry;

  return {
    ...sanitizeApri(apri),
    workflowSteps,
    canApproveCurrentStep: canApproveCurrentWorkflowStep(workflowSteps),
    canEdit,
    relatedPO: relatedPo
      ? {
          id: relatedPo._id.toString(),
          portalPONumber: relatedPo.portalPONumber,
          status: relatedPo.status,
          sapPODocNum: relatedPo.sapPODocNum,
        }
      : null,
    approvalHistory: history.map((h) => ({
      id: h._id.toString(),
      stepName: h.stepName,
      action: h.action,
      actionBy: h.actionBy?.name || h.actionBy?.username,
      actionByRole: h.actionByRole,
      comment: h.comment,
      previousStatus: h.previousStatus,
      newStatus: h.newStatus,
      actionDate: h.actionDate,
    })),
    emailLogs: emailLogs.map((e) => ({
      id: e._id.toString(),
      to: e.to,
      subject: e.subject,
      emailStatus: e.emailStatus,
      sentAt: e.sentAt,
      errorMessage: e.errorMessage,
    })),
  };
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
  if (!userCanApproveStep(user, step)) {
    const err = new Error('You do not have permission to approve this step');
    err.code = 'FORBIDDEN';
    throw err;
  }
  if (__v != null && __v !== apri.__v) {
    const err = new Error('Document changed');
    err.code = 'VERSION_CONFLICT';
    throw err;
  }

  const previousStatus = apri.status;
  const after = getStateAfterApproval(steps, apri.currentApprovalStep, 'APRI');

  await logApprovalHistory({
    documentType: DOC_TYPE,
    documentId: apri._id,
    stepName: step.stepName,
    action: 'Approved',
    actionBy: user,
    actionByRole: user.roleName,
    comment,
    previousStatus,
    newStatus: after.status,
  });

  if (after.isFinal) {
    apri.status = after.status;
    apri.currentApprovalStep = after.currentApprovalStep;
    await apri.save();

    const sapResult = await createSapApReserveInvoice(apri._id.toString(), user);
    const refreshed = await APReserveInvoice.findById(id).lean();
    return { apri: sanitizeApri(refreshed), sapResult };
  }

  apri.status = after.status;
  apri.currentApprovalStep = after.currentApprovalStep;
  await apri.save();
  return { apri: sanitizeApri(apri.toObject()), sapResult: null };
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
  if (!userCanApproveStep(user, step)) {
    const err = new Error('You do not have permission to reject this step');
    err.code = 'FORBIDDEN';
    throw err;
  }
  if (__v != null && __v !== apri.__v) {
    const err = new Error('Document changed');
    err.code = 'VERSION_CONFLICT';
    throw err;
  }

  const previousStatus = apri.status;
  apri.status = 'Rejected';
  apri.currentApprovalStep = 0;
  await apri.save();

  await logApprovalHistory({
    documentType: DOC_TYPE,
    documentId: apri._id,
    stepName: step.stepName,
    action: 'Rejected',
    actionBy: user,
    actionByRole: user.roleName,
    comment,
    previousStatus,
    newStatus: 'Rejected',
  });

  return sanitizeApri(apri.toObject());
}

export async function retryApriSap(id, user) {
  const sapResult = await retrySapApReserveInvoice(id, user);
  const refreshed = await APReserveInvoice.findById(id).lean();
  return { apri: sanitizeApri(refreshed), sapResult };
}
