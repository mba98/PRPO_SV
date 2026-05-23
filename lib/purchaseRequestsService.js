import mongoose from 'mongoose';
import '@/models/index.js';
import PurchaseRequest from '@/models/PurchaseRequest.js';
import User from '@/models/User.js';
import { connectDB } from '@/lib/mongodb';
import { buildPagination } from '@/lib/errors';
import { nextNumber } from '@/lib/numbering.js';
import {
  getApprovalSteps,
  getCurrentStep,
  getInitialSubmitState,
  getStateAfterApproval,
  pendingStatusForStep,
  userCanApproveStep,
} from '@/lib/approvalEngine.js';
import { getEffectivePermissions } from '@/lib/effectivePermissions.js';
import {
  canRetrySapPurchaseRequest,
  limitApprovedTabToOwnRequester,
  PR_POST_APPROVAL_STATUSES,
} from '@/lib/prPermissions.js';
import { canApproveCurrentWorkflowStep, loadPrWorkflow } from '@/lib/workflowSteps.js';
import { logApprovalHistory, getApprovalHistory } from '@/lib/auditHistory.js';
import { notifyEvent } from '@/lib/emailNotify.js';
import { listAttachments } from '@/lib/attachmentsService.js';
import SapIntegrationLog from '@/models/SapIntegrationLog.js';
import { formatSapReferenceSummary } from '@/lib/sap/mappers/prToSap.js';
import { createSapPurchaseRequest } from '@/lib/sap/prSap.js';

function parseDate(value) {
  if (!value) return undefined;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function normalizeLines(lines = []) {
  return lines.map((line) => {
    const qty = line.quantity;
    const unit = line.estimatedUnitPrice;
    let estimatedTotal = line.estimatedTotal;
    if (estimatedTotal == null && unit != null && qty != null) {
      estimatedTotal = unit * qty;
    }
    return {
      ...line,
      requiredDate: parseDate(line.requiredDate),
      uDelDate: parseDate(line.uDelDate),
      estimatedTotal,
    };
  });
}

function normalizeHeader(data) {
  const requiredDate = parseDate(data.requiredDate);
  return {
    department: data.department,
    project: data.project,
    requiredDate,
    dueDate: parseDate(data.dueDate) || requiredDate,
    postingDate: parseDate(data.postingDate),
    documentDate: parseDate(data.documentDate) || requiredDate,
    warehouse: data.warehouse,
    remarks: data.remarks,
    lines: normalizeLines(data.lines),
  };
}

export function sanitizePr(doc) {
  if (!doc) return null;
  const id = doc._id?.toString() || doc.id;
  return {
    id,
    portalPRNumber: doc.portalPRNumber,
    requester: doc.requester?._id?.toString() || doc.requester?.toString(),
    requesterName: doc.requester?.name || doc.requesterName,
    requesterEmail: doc.requesterEmail || doc.requester?.email,
    requesterSapRequesterCode: doc.requester?.sapRequesterCode || null,
    department: doc.department,
    project: doc.project,
    requiredDate: doc.requiredDate,
    dueDate: doc.dueDate,
    postingDate: doc.postingDate,
    documentDate: doc.documentDate,
    warehouse: doc.warehouse,
    remarks: doc.remarks,
    status: doc.status,
    currentApprovalStep: doc.currentApprovalStep,
    sapPRDocEntry: doc.sapPRDocEntry,
    sapPRDocNum: doc.sapPRDocNum,
    sapCreationStatus: doc.sapCreationStatus,
    sapErrorMessage: doc.sapErrorMessage,
    sapPODocEntry: doc.sapPODocEntry,
    sapPODocNum: doc.sapPODocNum,
    sapPOCreationStatus: doc.sapPOCreationStatus,
    sapPOErrorMessage: doc.sapPOErrorMessage,
    relatedPortalPONumber: doc.relatedPortalPONumber,
    lines: doc.lines || [],
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    __v: doc.__v,
  };
}

function userCanViewPr(user, pr) {
  const permissions = getEffectivePermissions(user);
  if (permissions.includes('view.all')) return true;
  const requesterId = pr.requester?._id?.toString() || pr.requester?.toString();
  if (requesterId === user._id.toString()) return true;
  if (permissions.includes('pr.approve.whs') || permissions.includes('pr.approve.pm')) {
    return true;
  }
  return false;
}

export async function buildPrPendingApprovalFilter(user) {
  const steps = await getApprovalSteps('PR');
  const permissions = getEffectivePermissions(user);

  if (permissions.includes('view.all')) {
    const statuses = steps.map((s) => pendingStatusForStep(s, 'PR'));
    return { status: { $in: statuses } };
  }

  const or = [];
  for (const step of steps) {
    if (permissions.includes(step.requiredPermission)) {
      or.push({
        status: pendingStatusForStep(step, 'PR'),
        currentApprovalStep: step.stepOrder,
      });
    }
  }
  return or.length ? { $or: or } : { _id: null };
}

export async function buildListFilter(user, params) {
  const filter = {};
  const { searchParams, tab } = params;
  const permissions = getEffectivePermissions(user);

  if (tab === 'my') {
    filter.requester = user._id;
  } else if (tab === 'pending') {
    Object.assign(filter, await buildPrPendingApprovalFilter(user));
  } else if (tab === 'approved') {
    filter.status = { $in: PR_POST_APPROVAL_STATUSES };
    if (limitApprovedTabToOwnRequester(user)) {
      filter.requester = user._id;
    }
  } else if (tab === 'failed-sap') {
    filter.status = 'Failed to Create in SAP';
    if (!permissions.includes('view.all') && !permissions.includes('admin.settings')) {
      if (limitApprovedTabToOwnRequester(user)) {
        filter.requester = user._id;
      }
    }
  } else if (tab === 'rejected') {
    filter.status = 'Rejected';
    if (!permissions.includes('view.all')) {
      filter.requester = user._id;
    }
  } else if (tab === 'sap') {
    filter.status = 'Created in SAP';
  } else if (tab === 'all') {
    if (!permissions.includes('view.all')) {
      const err = new Error('Forbidden');
      err.code = 'FORBIDDEN';
      throw err;
    }
  } else if (!permissions.includes('view.all')) {
    filter.requester = user._id;
  }

  const portalPRNumber = searchParams.get('portalPRNumber');
  if (portalPRNumber) filter.portalPRNumber = { $regex: portalPRNumber, $options: 'i' };
  const sapPRDocNum = searchParams.get('sapPRDocNum');
  if (sapPRDocNum) filter.sapPRDocNum = { $regex: sapPRDocNum, $options: 'i' };
  const department = searchParams.get('department');
  if (department) filter.department = { $regex: department, $options: 'i' };
  const project = searchParams.get('project');
  if (project) filter.project = { $regex: project, $options: 'i' };
  const warehouse = searchParams.get('warehouse');
  if (warehouse) filter.warehouse = { $regex: warehouse, $options: 'i' };
  const status = searchParams.get('status');
  if (status) filter.status = status;
  const step = searchParams.get('currentApprovalStep');
  if (step) filter.currentApprovalStep = parseInt(step, 10);
  const requester = searchParams.get('requester');
  if (requester && mongoose.Types.ObjectId.isValid(requester)) {
    filter.requester = requester;
  }
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }

  return filter;
}

export async function listPurchaseRequests(user, { page, limit, sort, order, searchParams }) {
  await connectDB();
  const tab = searchParams.get('tab') || 'my';
  const filter = await buildListFilter(user, { searchParams, tab });
  const sortDir = order === 'asc' ? 1 : -1;
  const sortField = sort || 'createdAt';

  const [total, rows] = await Promise.all([
    PurchaseRequest.countDocuments(filter),
    PurchaseRequest.find(filter)
      .populate('requester', 'name email sapRequesterCode')
      .sort({ [sortField]: sortDir })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ]);

  return {
    items: rows.map(sanitizePr),
    pagination: buildPagination(page, limit, total),
  };
}

export async function getPurchaseRequestById(id, user) {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  const pr = await PurchaseRequest.findById(id)
    .populate('requester', 'name email sapRequesterCode username')
    .lean();
  if (!pr) return null;
  if (!userCanViewPr(user, pr)) {
    const err = new Error('Forbidden');
    err.code = 'FORBIDDEN';
    throw err;
  }
  const [history, attachments] = await Promise.all([
    getApprovalHistory('PR', id),
    listAttachments('PR', id),
  ]);
  const workflowSteps = await loadPrWorkflow(pr, user);
  const sanitized = sanitizePr(pr);
  const requesterSapCode = pr.requester?.sapRequesterCode?.trim() || null;
  let sapReferenceSummary = null;
  if (pr.status === 'Failed to Create in SAP') {
    const lastLog = await SapIntegrationLog.findOne({
      documentType: 'PR',
      documentId: id,
      status: 'Failed',
    })
      .sort({ createdAt: -1 })
      .lean();
    if (lastLog?.requestPayload) {
      sapReferenceSummary = formatSapReferenceSummary(
        lastLog.requestPayload.sap,
        lastLog.requestPayload.debug,
      );
    }
  }
  return {
    ...sanitized,
    workflowSteps,
    canApproveCurrentStep: canApproveCurrentWorkflowStep(workflowSteps),
    canRetrySap:
      pr.status === 'Failed to Create in SAP' &&
      !pr.sapPRDocEntry &&
      canRetrySapPurchaseRequest(user),
    requesterMissingSapCode: !requesterSapCode,
    sapReferenceSummary,
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
    attachments,
  };
}

async function loadPrForUpdate(id, user) {
  const pr = await PurchaseRequest.findById(id);
  if (!pr) {
    const err = new Error('Purchase request not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (!userCanViewPr(user, pr.toObject())) {
    const err = new Error('Forbidden');
    err.code = 'FORBIDDEN';
    throw err;
  }
  return pr;
}

// Internal default so SAP branch mapping resolves without a user-entered department.
const DEFAULT_PR_DEPARTMENT = 'Procurement';

export async function createPurchaseRequest(data, user) {
  await connectDB();
  const portalPRNumber = await nextNumber('PR');
  const header = normalizeHeader(data);
  // Department is no longer collected from the user. Fall back to the
  // requester's department, then a safe internal default, so the SAP branch
  // mapping still resolves. Warehouse/project/cost center are left untouched.
  if (!header.department || !String(header.department).trim()) {
    header.department = user.department || DEFAULT_PR_DEPARTMENT;
  }
  const doc = await PurchaseRequest.create({
    ...header,
    portalPRNumber,
    requester: user._id,
    requesterEmail: user.email,
    createdBy: user._id,
    status: 'Draft',
    currentApprovalStep: 0,
  });

  await logApprovalHistory({
    documentType: 'PR',
    documentId: doc._id,
    stepName: 'Draft',
    action: 'Created',
    actionBy: user,
    actionByRole: user.roleName,
    previousStatus: null,
    newStatus: 'Draft',
  });

  return sanitizePr(doc.toObject());
}

export async function updatePurchaseRequest(id, data, user) {
  await connectDB();
  const pr = await loadPrForUpdate(id, user);
  assertRequesterOrAdmin(user, pr);
  if (pr.status !== 'Draft') {
    const err = new Error('Only draft purchase requests can be edited');
    err.code = 'INVALID_STATUS';
    throw err;
  }
  if (data.__v != null && data.__v !== pr.__v) {
    const err = new Error('Document changed');
    err.code = 'VERSION_CONFLICT';
    throw err;
  }
  const header = normalizeHeader(data);
  Object.assign(pr, header);
  await pr.save();
  return sanitizePr((await pr.populate('requester', 'name email')).toObject());
}

function assertRequesterOrAdmin(user, pr) {
  const requesterId = pr.requester?._id?.toString() || pr.requester?.toString();
  if (requesterId !== user._id.toString() && !getEffectivePermissions(user).includes('view.all')) {
    const err = new Error('Only the requester can perform this action');
    err.code = 'FORBIDDEN';
    throw err;
  }
}

export async function submitPurchaseRequest(id, user, { __v } = {}) {
  await connectDB();
  const pr = await loadPrForUpdate(id, user);
  assertRequesterOrAdmin(user, pr);
  if (pr.status !== 'Draft') {
    const err = new Error('Only draft purchase requests can be submitted');
    err.code = 'INVALID_STATUS';
    throw err;
  }
  if (__v != null && __v !== pr.__v) {
    const err = new Error('Document changed');
    err.code = 'VERSION_CONFLICT';
    throw err;
  }
  const steps = await getApprovalSteps('PR');
  const next = getInitialSubmitState(steps);
  const previousStatus = pr.status;
  pr.status = next.status;
  pr.currentApprovalStep = next.currentApprovalStep;
  await pr.save();

  const step = getCurrentStep(steps, pr.currentApprovalStep);
  await logApprovalHistory({
    documentType: 'PR',
    documentId: pr._id,
    stepName: step?.stepName || 'Submit',
    action: 'Submitted',
    actionBy: user,
    actionByRole: user.roleName,
    previousStatus,
    newStatus: pr.status,
  });

  await notifyEvent('pr.created', {
    subject: `PR ${pr.portalPRNumber} submitted for approval`,
    body: `Purchase Request ${pr.portalPRNumber} is pending your approval.`,
    relatedDocumentType: 'PR',
    relatedDocumentId: pr._id.toString(),
  });

  return sanitizePr(pr.toObject());
}

export async function approvePurchaseRequest(id, user, { comment, __v } = {}) {
  await connectDB();
  const pr = await loadPrForUpdate(id, user);
  const steps = await getApprovalSteps('PR');
  const step = getCurrentStep(steps, pr.currentApprovalStep);
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
  if (__v != null && __v !== pr.__v) {
    const err = new Error('Document changed');
    err.code = 'VERSION_CONFLICT';
    throw err;
  }

  const previousStatus = pr.status;
  const after = getStateAfterApproval(steps, pr.currentApprovalStep);

  await logApprovalHistory({
    documentType: 'PR',
    documentId: pr._id,
    stepName: step.stepName,
    action: 'Approved',
    actionBy: user,
    actionByRole: user.roleName,
    comment,
    previousStatus,
    newStatus: after.status,
  });

  if (after.isFinal) {
    pr.status = after.status;
    pr.currentApprovalStep = after.currentApprovalStep;
    await pr.save();

    const sapResult = await createSapPurchaseRequest(pr._id.toString(), user);
    const refreshed = await PurchaseRequest.findById(id).lean();
    return { pr: sanitizePr(refreshed), sapResult };
  }

  pr.status = after.status;
  pr.currentApprovalStep = after.currentApprovalStep;
  await pr.save();

  await notifyEvent('pr.whs.approved', {
    subject: `PR ${pr.portalPRNumber} approved — pending PM`,
    body: `Purchase Request ${pr.portalPRNumber} requires project manager approval.`,
    relatedDocumentType: 'PR',
    relatedDocumentId: pr._id.toString(),
  });

  return { pr: sanitizePr(pr.toObject()), sapResult: null };
}

export async function rejectPurchaseRequest(id, user, { comment, __v } = {}) {
  await connectDB();
  const pr = await loadPrForUpdate(id, user);
  const steps = await getApprovalSteps('PR');
  const step = getCurrentStep(steps, pr.currentApprovalStep);
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
  if (__v != null && __v !== pr.__v) {
    const err = new Error('Document changed');
    err.code = 'VERSION_CONFLICT';
    throw err;
  }

  const previousStatus = pr.status;
  pr.status = 'Rejected';
  pr.currentApprovalStep = 0;
  await pr.save();

  await logApprovalHistory({
    documentType: 'PR',
    documentId: pr._id,
    stepName: step.stepName,
    action: 'Rejected',
    actionBy: user,
    actionByRole: user.roleName,
    comment,
    previousStatus,
    newStatus: 'Rejected',
  });

  await notifyEvent('pr.rejected', {
    subject: `PR ${pr.portalPRNumber} rejected`,
    body: `Purchase Request ${pr.portalPRNumber} was rejected.${comment ? ` Comment: ${comment}` : ''}`,
    relatedDocumentType: 'PR',
    relatedDocumentId: pr._id.toString(),
  });

  return sanitizePr(pr.toObject());
}

export async function retrySapPurchaseRequest(id, user) {
  await connectDB();
  if (!canRetrySapPurchaseRequest(user)) {
    const err = new Error('You do not have permission to retry SAP creation');
    err.code = 'FORBIDDEN';
    throw err;
  }
  const pr = await PurchaseRequest.findById(id).lean();
  if (!pr) {
    const err = new Error('Purchase request not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (pr.sapPRDocEntry) {
    const err = new Error('SAP PR already exists');
    err.code = 'DUPLICATE_SAP';
    throw err;
  }
  if (!['Approved', 'Failed to Create in SAP'].includes(pr.status)) {
    const err = new Error('Purchase request is not eligible for SAP retry');
    err.code = 'INVALID_STATUS';
    throw err;
  }
  const result = await createSapPurchaseRequest(id, user);
  const refreshed = await PurchaseRequest.findById(id).lean();
  return { pr: sanitizePr(refreshed), sapResult: result };
}

export async function listApprovedForPo(user, { page, limit }) {
  await connectDB();
  const filter = { status: 'Created in SAP' };
  if (
    !getEffectivePermissions(user).includes('view.all') &&
    !getEffectivePermissions(user).includes('po.create')
  ) {
    filter.requester = user._id;
  }
  const [total, rows] = await Promise.all([
    PurchaseRequest.countDocuments(filter),
    PurchaseRequest.find(filter)
      .populate('requester', 'name email sapRequesterCode')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ]);
  return {
    items: rows.map(sanitizePr),
    pagination: buildPagination(page, limit, total),
  };
}
