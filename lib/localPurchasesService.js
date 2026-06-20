import mongoose from 'mongoose';
import '@/models/index.js';
import LocalPurchase from '@/models/LocalPurchase.js';
import { connectDB } from '@/lib/mongodb';
import { buildPagination } from '@/lib/errors';
import { LP_SORT_FIELDS, resolveSortField } from '@/lib/listQuery.js';
import { nextNumber } from '@/lib/numbering.js';
import {
  getApprovalSteps,
  getCurrentStep,
  getInitialSubmitState,
  getStateAfterApproval,
  pendingStatusForStep,
} from '@/lib/approvalEngine.js';
import { getEffectivePermissions } from '@/lib/effectivePermissions.js';
import { loadLpWorkflow } from '@/lib/workflowSteps.js';
import { assertUserCanApproveDocument, buildDocumentApprovalAccess } from '@/lib/documentApprovalAuth.js';
import { assertImplementedCompletionPolicy } from '@/lib/approvalPolicies.js';
import {
  assertApprovalVersionMatches,
  atomicDocumentStepTransition,
  buildAtomicStepFilter,
  logStepApprovalHistory,
  rejectedStatusForDocumentType,
} from '@/lib/approvalTransition.js';
import { logApprovalHistory } from '@/lib/auditHistory.js';
import { notifyWorkflowEmailSafe } from '@/lib/emailNotify.js';
import { buildLpEmailContext } from '@/lib/emailContext.js';
import { buildApprovalActionResult } from '@/lib/approvalActionResponse.js';
import { LP_LIST_SELECT, lineCount } from '@/lib/listFields.js';
import { perfAsync } from '@/lib/perfLog.js';
import {
  LP_CREATE_PERMISSION,
  LP_VIEW_ALL_PERMISSION,
  userCanCancelLocalPurchase,
  userCanEditLocalPurchase,
  userCanViewLocalPurchase,
  userHasAnyLpApprovalPermission,
} from '@/lib/localPurchasePermissions.js';
import {
  LP_STATUS,
  isPendingLpApprovalStatus,
  lpStatusInQuery,
  lpStatusesEqual,
  normalizeLpStatus,
} from '@/lib/localPurchaseStatus.js';
import { normalizeId } from '@/lib/normalizeId.js';

const DOC_TYPE = 'LOCAL_PURCHASE';

function parseDate(value) {
  if (!value) return undefined;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export function recalculateLpLines(lines = []) {
  return lines.map((line) => sanitizeLpLine(line));
}

export function sanitizeLpLine(line) {
  const qty = Number(line?.quantity) || 0;
  const unitPrice = Number(line?.unitPrice) || 0;
  const sanitized = {
    description: String(line?.description || '').trim(),
    quantity: qty,
    unitPrice,
    lineTotal: qty * unitPrice,
  };
  if (line?.notes != null && String(line.notes).trim()) {
    sanitized.notes = String(line.notes).trim();
  }
  if (line?._id) {
    sanitized._id = line._id?.toString?.() || line._id;
  }
  return sanitized;
}

export function recalculateLpDocumentTotal(lines = []) {
  return lines.reduce((sum, line) => sum + (Number(line.lineTotal) || 0), 0);
}

function normalizeBudget(value) {
  const budget = Number(value);
  if (!Number.isFinite(budget)) {
    const err = new Error('Budget must be a valid number');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }
  if (budget < 0) {
    const err = new Error('Budget must be zero or greater');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }
  return budget;
}

function normalizeHeader(data) {
  const lines = recalculateLpLines(data.lines || []);
  return {
    documentDate: parseDate(data.documentDate),
    budget: normalizeBudget(data.budget),
    remarks: data.remarks ? String(data.remarks).trim() : undefined,
    lines,
    documentTotal: recalculateLpDocumentTotal(lines),
  };
}

export function sanitizeLocalPurchase(doc) {
  if (!doc) return null;
  const id = doc._id?.toString() || doc.id;
  const lines = (doc.lines || []).map((line) => sanitizeLpLine(line));
  return {
    id,
    portalLPNumber: doc.portalLPNumber,
    documentDate: doc.documentDate,
    budget: Number(doc.budget ?? 0),
    remarks: doc.remarks,
    lines,
    documentTotal: doc.documentTotal,
    status: doc.status,
    currentApprovalStep: doc.currentApprovalStep,
    createdBy: doc.createdBy?._id?.toString() || doc.createdBy?.toString(),
    createdByName: doc.createdBy?.name || doc.createdByName,
    submittedAt: doc.submittedAt,
    completedAt: doc.completedAt,
    rejectedAt: doc.rejectedAt,
    cancelledAt: doc.cancelledAt,
    rejectionReason: doc.rejectionReason,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    __v: doc.__v,
  };
}

export function sanitizeLocalPurchaseListItem(doc) {
  const base = sanitizeLocalPurchase(doc);
  if (!base) return null;
  const { lines, ...rest } = base;
  return { ...rest, lineCount: lineCount(doc) };
}

async function buildLpPendingApprovalFilter(user) {
  const steps = await getApprovalSteps(DOC_TYPE);
  const permissions = getEffectivePermissions(user);

  if (permissions.includes(LP_VIEW_ALL_PERMISSION)) {
    const statuses = steps.map((s) => pendingStatusForStep(s, DOC_TYPE));
    return { status: lpStatusInQuery(...statuses) };
  }

  const or = [];
  for (const step of steps) {
    if (permissions.includes(step.requiredPermission)) {
      or.push({
        status: lpStatusInQuery(pendingStatusForStep(step, DOC_TYPE)),
        currentApprovalStep: step.stepOrder,
      });
    }
  }
  return or.length ? { $or: or } : { _id: null };
}

async function buildListFilter(user, { searchParams, tab }) {
  const permissions = getEffectivePermissions(user);
  const filter = {};

  if (tab === 'my') {
    filter.createdBy = user._id;
  } else if (tab === 'pending') {
    Object.assign(filter, await buildLpPendingApprovalFilter(user));
  } else if (tab === 'rejected') {
    filter.status = lpStatusInQuery(LP_STATUS.REJECTED);
    if (!permissions.includes(LP_VIEW_ALL_PERMISSION)) {
      filter.createdBy = user._id;
    }
  } else if (tab === 'completed') {
    filter.status = lpStatusInQuery(LP_STATUS.COMPLETED);
    if (!permissions.includes(LP_VIEW_ALL_PERMISSION)) {
      filter.createdBy = user._id;
    }
  } else if (tab === 'all') {
    if (!permissions.includes(LP_VIEW_ALL_PERMISSION)) {
      const err = new Error('Forbidden');
      err.code = 'FORBIDDEN';
      throw err;
    }
  } else if (!permissions.includes(LP_VIEW_ALL_PERMISSION)) {
    filter.createdBy = user._id;
  }

  const portalLPNumber = searchParams.get('portalLPNumber');
  if (portalLPNumber) filter.portalLPNumber = { $regex: portalLPNumber, $options: 'i' };
  const status = searchParams.get('status');
  if (status) filter.status = normalizeLpStatus(status);
  const createdBy = searchParams.get('createdBy');
  if (createdBy && permissions.includes(LP_VIEW_ALL_PERMISSION)) {
    if (mongoose.Types.ObjectId.isValid(createdBy)) {
      filter.createdBy = createdBy;
    }
  }
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  if (from || to) {
    filter.documentDate = {};
    if (from) filter.documentDate.$gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      filter.documentDate.$lte = end;
    }
  }

  return filter;
}

export async function listLocalPurchases(user, params) {
  return perfAsync('listLocalPurchases', async () => {
    await connectDB();
    const { searchParams, tab: tabParam, page, limit, sort, order } = params;
    const tab = tabParam || searchParams.get('tab') || 'my';
    const filter = await buildListFilter(user, { searchParams, tab });
    const sortField = resolveSortField(sort, LP_SORT_FIELDS);
    const sortDir = order === 'asc' ? 1 : -1;

    const [items, total] = await Promise.all([
      LocalPurchase.find(filter)
        .select(LP_LIST_SELECT)
        .populate('createdBy', 'name email')
        .sort({ [sortField]: sortDir })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      LocalPurchase.countDocuments(filter),
    ]);

    return {
      items: items.map(sanitizeLocalPurchaseListItem),
      pagination: buildPagination({ page, limit, total }),
    };
  });
}

async function buildLocalPurchaseDetailPayload(doc, user, steps) {
  const workflowSteps = await loadLpWorkflow(doc, user, steps);
  const canEdit = userCanEditLocalPurchase(user, doc);
  const canCancel = userCanCancelLocalPurchase(user, doc);
  const canSubmit =
    canEdit &&
    (lpStatusesEqual(doc.status, LP_STATUS.DRAFT) || lpStatusesEqual(doc.status, LP_STATUS.REJECTED));
  const canResubmit = canSubmit && lpStatusesEqual(doc.status, LP_STATUS.REJECTED);

  const approvalAccess = buildDocumentApprovalAccess({
    documentType: DOC_TYPE,
    document: sanitizeLocalPurchase(doc),
    user,
    approvalSteps: steps,
  });

  return {
    ...sanitizeLocalPurchase(doc),
    workflowSteps,
    ...approvalAccess,
    canEdit,
    canCancel,
    canSubmit,
    canResubmit,
  };
}

export async function getLocalPurchaseById(id, user) {
  return perfAsync(`getLocalPurchaseById ${id}`, async () => {
    await connectDB();
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    const steps = await getApprovalSteps(DOC_TYPE);
    const doc = await LocalPurchase.findById(id).populate('createdBy', 'name email').lean();
    if (!doc) return null;
    if (!userCanViewLocalPurchase(user, doc)) {
      const err = new Error('Forbidden');
      err.code = 'FORBIDDEN';
      throw err;
    }
    return buildLocalPurchaseDetailPayload(doc, user, steps);
  });
}

async function loadLpForUpdate(id, user) {
  await connectDB();
  const doc = await LocalPurchase.findById(id);
  if (!doc) {
    const err = new Error('Local Purchase not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (!userCanViewLocalPurchase(user, doc.toObject())) {
    const err = new Error('Forbidden');
    err.code = 'FORBIDDEN';
    throw err;
  }
  return doc;
}

export async function createLocalPurchase(data, user) {
  await connectDB();
  const permissions = getEffectivePermissions(user);
  if (!permissions.includes(LP_CREATE_PERMISSION)) {
    const err = new Error('Forbidden');
    err.code = 'FORBIDDEN';
    throw err;
  }

  const header = normalizeHeader(data);
  const portalLPNumber = await nextNumber('LP');

  const doc = await LocalPurchase.create({
    ...header,
    portalLPNumber,
    status: LP_STATUS.DRAFT,
    currentApprovalStep: 0,
    createdBy: user._id,
    updatedBy: user._id,
  });

  await logApprovalHistory({
    documentType: DOC_TYPE,
    documentId: doc._id,
    stepName: 'Create',
    action: 'Created',
    actionBy: user,
    actionByRole: user.roleName,
    newStatus: LP_STATUS.DRAFT,
  });

  return sanitizeLocalPurchase((await doc.populate('createdBy', 'name email')).toObject());
}

export async function updateLocalPurchase(id, data, user) {
  const doc = await loadLpForUpdate(id, user);
  if (!userCanEditLocalPurchase(user, doc.toObject())) {
    const err = new Error('This Local Purchase cannot be edited');
    err.code = 'FORBIDDEN';
    throw err;
  }
  assertApprovalVersionMatches(doc, data.__v);

  const previousStatus = doc.status;
  const header = normalizeHeader(data);

  Object.assign(doc, header);
  doc.updatedBy = user._id;
  doc.markModified('lines');
  await doc.save();

  await logApprovalHistory({
    documentType: DOC_TYPE,
    documentId: doc._id,
    stepName: 'Edit',
    action: 'Updated',
    actionBy: user,
    actionByRole: user.roleName,
    previousStatus,
    newStatus: doc.status,
    comment: 'Local Purchase updated',
  });

  return sanitizeLocalPurchase((await doc.populate('createdBy', 'name email')).toObject());
}

async function submitOrResubmit(doc, user, { __v, isResubmit }) {
  if (!userCanEditLocalPurchase(user, doc.toObject())) {
    const err = new Error('Forbidden');
    err.code = 'FORBIDDEN';
    throw err;
  }
  assertApprovalVersionMatches(doc, __v);

  if (isResubmit) {
    if (!lpStatusesEqual(doc.status, LP_STATUS.REJECTED)) {
      const err = new Error('Only rejected Local Purchases can be resubmitted');
      err.code = 'INVALID_STATUS';
      throw err;
    }
  } else if (!lpStatusesEqual(doc.status, LP_STATUS.DRAFT)) {
    const err = new Error('Only draft Local Purchases can be submitted');
    err.code = 'INVALID_STATUS';
    throw err;
  }

  const steps = await getApprovalSteps(DOC_TYPE);
  const next = getInitialSubmitState(steps, DOC_TYPE);
  const previousStatus = doc.status;

  doc.status = next.status;
  doc.currentApprovalStep = next.currentApprovalStep;
  doc.submittedAt = new Date();
  doc.rejectionReason = undefined;
  doc.rejectedAt = undefined;
  doc.updatedBy = user._id;
  await doc.save();

  await logApprovalHistory({
    documentType: DOC_TYPE,
    documentId: doc._id,
    stepName: isResubmit ? 'Resubmit' : 'Submit',
    action: 'Submitted',
    actionBy: user,
    actionByRole: user.roleName,
    previousStatus,
    newStatus: doc.status,
  });

  const eventKey = isResubmit ? 'local_purchase.resubmitted' : 'local_purchase.submitted';
  notifyWorkflowEmailSafe(
    eventKey,
    buildLpEmailContext(doc.toObject()),
    { documentType: DOC_TYPE, documentId: doc._id.toString() },
  );

  notifyWorkflowEmailSafe(
    'local_purchase.pending_pm',
    buildLpEmailContext(doc.toObject()),
    { documentType: DOC_TYPE, documentId: doc._id.toString() },
  );

  return sanitizeLocalPurchase((await doc.populate('createdBy', 'name email')).toObject());
}

export async function submitLocalPurchase(id, user, { __v } = {}) {
  const doc = await loadLpForUpdate(id, user);
  return submitOrResubmit(doc, user, { __v, isResubmit: false });
}

export async function resubmitLocalPurchase(id, user, { __v } = {}) {
  const doc = await loadLpForUpdate(id, user);
  return submitOrResubmit(doc, user, { __v, isResubmit: true });
}

export async function approveLocalPurchase(id, user, { comment, __v } = {}) {
  await connectDB();
  const doc = await loadLpForUpdate(id, user);
  const steps = await getApprovalSteps(DOC_TYPE);
  const step = getCurrentStep(steps, doc.currentApprovalStep);
  if (!step) {
    const err = new Error('No pending approval step');
    err.code = 'INVALID_STATUS';
    throw err;
  }
  assertUserCanApproveDocument({
    documentType: DOC_TYPE,
    document: doc.toObject(),
    user,
    approvalSteps: steps,
    step,
    action: 'approve',
  });
  assertImplementedCompletionPolicy(step);
  assertApprovalVersionMatches(doc, __v);

  const previousStatus = doc.status;
  const after = getStateAfterApproval(steps, doc.currentApprovalStep, DOC_TYPE);

  const setFields = {
    status: after.status,
    currentApprovalStep: after.currentApprovalStep,
    updatedBy: user._id,
  };
  if (after.isFinal) {
    setFields.completedAt = new Date();
  }

  const updated = await atomicDocumentStepTransition(
    LocalPurchase,
    buildAtomicStepFilter(doc, __v),
    setFields,
  );

  await logStepApprovalHistory({
    documentType: DOC_TYPE,
    documentId: doc._id,
    step,
    action: 'Approved',
    user,
    comment,
    previousStatus,
    newStatus: after.status,
  });

  if (after.isFinal) {
    notifyWorkflowEmailSafe(
      'local_purchase.completed',
      buildLpEmailContext(updated.toObject()),
      { documentType: DOC_TYPE, documentId: updated._id.toString() },
    );
  } else if (step.requiredPermission === 'lp.approve.pm') {
    notifyWorkflowEmailSafe(
      'local_purchase.pending_finance',
      buildLpEmailContext(updated.toObject()),
      { documentType: DOC_TYPE, documentId: updated._id.toString() },
    );
  }

  const refreshed = await LocalPurchase.findById(id).populate('createdBy', 'name email').lean();
  return buildApprovalActionResult(DOC_TYPE, buildLocalPurchaseDetailPayload(refreshed, user, steps), user, {
    message: 'Approved successfully',
    sapResult: null,
  });
}

export async function rejectLocalPurchase(id, user, { comment, __v } = {}) {
  await connectDB();
  const doc = await loadLpForUpdate(id, user);
  const steps = await getApprovalSteps(DOC_TYPE);
  const step = getCurrentStep(steps, doc.currentApprovalStep);
  if (!step) {
    const err = new Error('No pending approval step');
    err.code = 'INVALID_STATUS';
    throw err;
  }
  assertUserCanApproveDocument({
    documentType: DOC_TYPE,
    document: doc.toObject(),
    user,
    approvalSteps: steps,
    step,
    action: 'reject',
  });
  assertImplementedCompletionPolicy(step);
  assertApprovalVersionMatches(doc, __v);

  const previousStatus = doc.status;
  const rejectedStatus = rejectedStatusForDocumentType(DOC_TYPE);

  const updated = await atomicDocumentStepTransition(
    LocalPurchase,
    buildAtomicStepFilter(doc, __v),
    {
      status: rejectedStatus,
      currentApprovalStep: 0,
      rejectionReason: comment,
      rejectedAt: new Date(),
      updatedBy: user._id,
    },
  );

  await logStepApprovalHistory({
    documentType: DOC_TYPE,
    documentId: doc._id,
    step,
    action: 'Rejected',
    user,
    comment,
    previousStatus,
    newStatus: rejectedStatus,
  });

  notifyWorkflowEmailSafe(
    'local_purchase.rejected',
    {
      ...buildLpEmailContext(updated.toObject()),
      rejectionReason: comment,
      rejectingStep: step.stepName,
    },
    { documentType: DOC_TYPE, documentId: updated._id.toString() },
  );

  const refreshed = await LocalPurchase.findById(id).populate('createdBy', 'name email').lean();
  return buildApprovalActionResult(DOC_TYPE, buildLocalPurchaseDetailPayload(refreshed, user, steps), user, {
    message: 'Rejected',
    sapResult: null,
  });
}

export async function cancelLocalPurchase(id, user, { comment, __v } = {}) {
  const doc = await loadLpForUpdate(id, user);
  if (!userCanCancelLocalPurchase(user, doc.toObject())) {
    const err = new Error('Forbidden');
    err.code = 'FORBIDDEN';
    throw err;
  }
  assertApprovalVersionMatches(doc, __v);

  const previousStatus = doc.status;
  doc.status = LP_STATUS.CANCELLED;
  doc.currentApprovalStep = 0;
  doc.cancelledAt = new Date();
  doc.updatedBy = user._id;
  await doc.save();

  await logApprovalHistory({
    documentType: DOC_TYPE,
    documentId: doc._id,
    stepName: 'Cancel',
    action: 'Cancelled',
    actionBy: user,
    actionByRole: user.roleName,
    comment,
    previousStatus,
    newStatus: LP_STATUS.CANCELLED,
  });

  notifyWorkflowEmailSafe(
    'local_purchase.cancelled',
    buildLpEmailContext(doc.toObject()),
    { documentType: DOC_TYPE, documentId: doc._id.toString() },
  );

  return sanitizeLocalPurchase((await doc.populate('createdBy', 'name email')).toObject());
}

export async function deleteLocalPurchase(id, user) {
  const doc = await loadLpForUpdate(id, user);
  if (!lpStatusesEqual(doc.status, LP_STATUS.DRAFT)) {
    const err = new Error('Only draft Local Purchases can be deleted');
    err.code = 'INVALID_STATUS';
    throw err;
  }
  if (normalizeId(doc.createdBy) !== normalizeId(user._id)) {
    const err = new Error('Forbidden');
    err.code = 'FORBIDDEN';
    throw err;
  }
  await doc.deleteOne();
  return { deleted: true, id };
}

export { DOC_TYPE as LOCAL_PURCHASE_DOC_TYPE };
