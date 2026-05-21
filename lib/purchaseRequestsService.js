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
  userCanApproveStep,
} from '@/lib/approvalEngine.js';
import { logApprovalHistory, getApprovalHistory } from '@/lib/auditHistory.js';
import { notifyEvent } from '@/lib/emailNotify.js';
import { listAttachments } from '@/lib/attachmentsService.js';
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
  return {
    department: data.department,
    project: data.project,
    requiredDate: parseDate(data.requiredDate),
    postingDate: parseDate(data.postingDate),
    documentDate: parseDate(data.documentDate),
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
    department: doc.department,
    project: doc.project,
    requiredDate: doc.requiredDate,
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
  if (user.permissions?.includes('view.all')) return true;
  const requesterId = pr.requester?._id?.toString() || pr.requester?.toString();
  if (requesterId === user._id.toString()) return true;
  if (['Pending Warehouse Approval', 'Pending Project Manager Approval'].includes(pr.status)) {
    return (
      user.permissions?.includes('pr.approve.whs') || user.permissions?.includes('pr.approve.pm')
    );
  }
  return false;
}

function buildListFilter(user, params) {
  const filter = {};
  const { searchParams, tab } = params;

  if (tab === 'my') {
    filter.requester = user._id;
  } else if (tab === 'pending') {
    filter.status = {
      $in: ['Pending Warehouse Approval', 'Pending Project Manager Approval'],
    };
    const or = [];
    if (user.permissions?.includes('pr.approve.whs')) {
      or.push({ status: 'Pending Warehouse Approval' });
    }
    if (user.permissions?.includes('pr.approve.pm')) {
      or.push({ status: 'Pending Project Manager Approval' });
    }
    if (!user.permissions?.includes('view.all')) {
      filter.$or = or.length ? or : [{ _id: null }];
    }
  } else if (tab === 'approved') {
    filter.status = {
      $in: ['Approved', 'Creating in SAP', 'Created in SAP', 'Failed to Create in SAP'],
    };
    if (!user.permissions?.includes('view.all')) {
      filter.requester = user._id;
    }
  } else if (tab === 'rejected') {
    filter.status = 'Rejected';
    if (!user.permissions?.includes('view.all')) {
      filter.requester = user._id;
    }
  } else if (tab === 'sap') {
    filter.status = 'Created in SAP';
  } else if (tab === 'all') {
    if (!user.permissions?.includes('view.all')) {
      const err = new Error('Forbidden');
      err.code = 'FORBIDDEN';
      throw err;
    }
  } else if (!user.permissions?.includes('view.all')) {
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
  const filter = buildListFilter(user, { searchParams, tab });
  const sortDir = order === 'asc' ? 1 : -1;
  const sortField = sort || 'createdAt';

  const [total, rows] = await Promise.all([
    PurchaseRequest.countDocuments(filter),
    PurchaseRequest.find(filter)
      .populate('requester', 'name email')
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
  const pr = await PurchaseRequest.findById(id).populate('requester', 'name email').lean();
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
  return {
    ...sanitizePr(pr),
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

export async function createPurchaseRequest(data, user) {
  await connectDB();
  const portalPRNumber = await nextNumber('PR');
  const header = normalizeHeader(data);
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
  if (requesterId !== user._id.toString() && !user.permissions?.includes('view.all')) {
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
  if (!user.permissions?.includes('view.all') && !user.permissions?.includes('po.create')) {
    filter.requester = user._id;
  }
  const [total, rows] = await Promise.all([
    PurchaseRequest.countDocuments(filter),
    PurchaseRequest.find(filter)
      .populate('requester', 'name email')
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
