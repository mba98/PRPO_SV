import mongoose from 'mongoose';
import '@/models/index.js';
import PurchaseOrder from '@/models/PurchaseOrder.js';
import PurchaseRequest from '@/models/PurchaseRequest.js';
import { connectDB } from '@/lib/mongodb';
import { buildPagination } from '@/lib/errors';
import { sanitizePr } from '@/lib/purchaseRequestsService';
import { enrichPrForPoList } from '@/lib/prPoReadiness.js';
import { createPortalPoFromPr } from '@/lib/sap/poFromPrSap.js';
import { createSapPurchaseOrder, retrySapPurchaseOrder } from '@/lib/sap/poSap.js';
import {
  getApprovalSteps,
  getCurrentStep,
  getStateAfterApproval,
  userCanApproveStep,
} from '@/lib/approvalEngine.js';
import { logApprovalHistory, getApprovalHistory } from '@/lib/auditHistory.js';
import { notifyEvent } from '@/lib/emailNotify.js';
import { listAttachments } from '@/lib/attachmentsService.js';

const DOC_TYPE = 'PO';
const LIST_PERMS = ['po.create', 'po.approve.pm', 'po.approve.finance', 'view.all'];

export function sanitizePo(doc) {
  if (!doc) return null;
  const id = doc._id?.toString() || doc.id;
  return {
    id,
    portalPONumber: doc.portalPONumber,
    relatedPRId: doc.relatedPRId?._id?.toString() || doc.relatedPRId?.toString(),
    relatedPRNumber: doc.relatedPRNumber,
    relatedSAPPRDocEntry: doc.relatedSAPPRDocEntry,
    relatedSAPPRDocNum: doc.relatedSAPPRDocNum,
    requester: doc.requester?._id?.toString() || doc.requester?.toString(),
    requesterName: doc.requester?.name,
    department: doc.department,
    project: doc.project,
    vendor: doc.vendor,
    warehouse: doc.warehouse,
    requiredDate: doc.requiredDate,
    postingDate: doc.postingDate,
    documentDate: doc.documentDate,
    remarks: doc.remarks,
    status: doc.status,
    currentApprovalStep: doc.currentApprovalStep,
    sapPODocEntry: doc.sapPODocEntry,
    sapPODocNum: doc.sapPODocNum,
    sapCreationStatus: doc.sapCreationStatus,
    sapErrorMessage: doc.sapErrorMessage,
    lines: doc.lines || [],
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    __v: doc.__v,
  };
}

function userCanViewPo(user, po) {
  if (user.permissions?.includes('view.all')) return true;
  const requesterId = po.requester?._id?.toString() || po.requester?.toString();
  if (requesterId === user._id.toString()) return true;
  if (
    ['Pending Project Manager Approval', 'Pending Finance Approval'].includes(po.status)
  ) {
    return (
      user.permissions?.includes('po.approve.pm') ||
      user.permissions?.includes('po.approve.finance')
    );
  }
  return user.permissions?.some((p) => LIST_PERMS.includes(p));
}

function buildListFilter(user, { searchParams, tab }) {
  const filter = {};
  if (tab === 'pending') {
    filter.status = {
      $in: ['Pending Project Manager Approval', 'Pending Finance Approval'],
    };
    const or = [];
    if (user.permissions?.includes('po.approve.pm')) {
      or.push({ status: 'Pending Project Manager Approval' });
    }
    if (user.permissions?.includes('po.approve.finance')) {
      or.push({ status: 'Pending Finance Approval' });
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

  const portalPONumber = searchParams.get('portalPONumber');
  if (portalPONumber) filter.portalPONumber = { $regex: portalPONumber, $options: 'i' };
  const relatedPRNumber = searchParams.get('relatedPRNumber');
  if (relatedPRNumber) filter.relatedPRNumber = { $regex: relatedPRNumber, $options: 'i' };
  const vendor = searchParams.get('vendor');
  if (vendor) filter.vendor = { $regex: vendor, $options: 'i' };
  const status = searchParams.get('status');
  if (status) filter.status = status;
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }
  return filter;
}

export async function listPurchaseOrders(user, { page, limit, sort, order, searchParams }) {
  await connectDB();
  const tab = searchParams.get('tab') || 'pending';
  const filter = buildListFilter(user, { searchParams, tab });
  const sortDir = order === 'asc' ? 1 : -1;
  const sortField = sort || 'createdAt';

  const [total, rows] = await Promise.all([
    PurchaseOrder.countDocuments(filter),
    PurchaseOrder.find(filter)
      .populate('requester', 'name email')
      .sort({ [sortField]: sortDir })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ]);

  return {
    items: rows.map(sanitizePo),
    pagination: buildPagination(page, limit, total),
  };
}

export async function listPrsReadyForPo(user, { page, limit }) {
  await connectDB();
  const filter = {
    status: { $in: ['Created in SAP', 'Partially Ordered'] },
    sapPRDocEntry: { $exists: true, $ne: null },
  };
  if (!user.permissions?.includes('view.all') && !user.permissions?.includes('po.create')) {
    filter.requester = user._id;
  }

  const rows = await PurchaseRequest.find(filter)
    .populate('requester', 'name email')
    .sort({ createdAt: -1 })
    .lean();

  const prIds = rows.map((r) => r._id);
  const orders = await PurchaseOrder.find({ relatedPRId: { $in: prIds } }).lean();

  const enriched = rows
    .map((pr) => {
      const meta = enrichPrForPoList(pr, orders);
      return { ...sanitizePr(pr), ...meta };
    })
    .filter((pr) => pr.poReady);

  const total = enriched.length;
  const start = (page - 1) * limit;
  return {
    items: enriched.slice(start, start + limit),
    pagination: buildPagination(page, limit, total),
  };
}

export async function listPosReadyForApri(user, { page, limit }) {
  await connectDB();
  const filter = { status: 'Created in SAP' };
  if (!user.permissions?.includes('view.all') && !user.permissions?.includes('apinvoice.create')) {
    filter.requester = user._id;
  }
  const [total, rows] = await Promise.all([
    PurchaseOrder.countDocuments(filter),
    PurchaseOrder.find(filter)
      .populate('requester', 'name email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ]);
  return {
    items: rows.map(sanitizePo),
    pagination: buildPagination(page, limit, total),
  };
}

export async function getPurchaseOrderById(id, user) {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  const po = await PurchaseOrder.findById(id).populate('requester', 'name email').lean();
  if (!po) return null;
  if (!userCanViewPo(user, po)) {
    const err = new Error('Forbidden');
    err.code = 'FORBIDDEN';
    throw err;
  }
  const [history, attachments] = await Promise.all([
    getApprovalHistory(DOC_TYPE, id),
    listAttachments(DOC_TYPE, id),
  ]);
  return {
    ...sanitizePo(po),
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

async function loadPoForUpdate(id, user) {
  const po = await PurchaseOrder.findById(id);
  if (!po) {
    const err = new Error('Purchase order not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (!userCanViewPo(user, po.toObject())) {
    const err = new Error('Forbidden');
    err.code = 'FORBIDDEN';
    throw err;
  }
  return po;
}

export async function createPurchaseOrderFromPr(prId, user, { vendor }) {
  return createPortalPoFromPr(prId, user, { vendor });
}

export async function updatePurchaseOrder(id, data, user) {
  await connectDB();
  const po = await loadPoForUpdate(id, user);
  const editable = [
    'Pending Project Manager Approval',
    'Pending Finance Approval',
    'Approved',
  ];
  if (!editable.includes(po.status) || po.sapPODocEntry) {
    const err = new Error('Purchase order cannot be edited in current status');
    err.code = 'INVALID_STATUS';
    throw err;
  }
  if (data.__v != null && data.__v !== po.__v) {
    const err = new Error('Document changed');
    err.code = 'VERSION_CONFLICT';
    throw err;
  }
  if (data.remarks != null) po.remarks = data.remarks;
  if (data.requiredDate) po.requiredDate = new Date(data.requiredDate);
  await po.save();
  return sanitizePo((await po.populate('requester', 'name email')).toObject());
}

export async function approvePurchaseOrder(id, user, { comment, __v } = {}) {
  await connectDB();
  const po = await loadPoForUpdate(id, user);
  const steps = await getApprovalSteps(DOC_TYPE);
  const step = getCurrentStep(steps, po.currentApprovalStep);
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
  if (__v != null && __v !== po.__v) {
    const err = new Error('Document changed');
    err.code = 'VERSION_CONFLICT';
    throw err;
  }

  const previousStatus = po.status;
  const after = getStateAfterApproval(steps, po.currentApprovalStep, DOC_TYPE);

  await logApprovalHistory({
    documentType: DOC_TYPE,
    documentId: po._id,
    stepName: step.stepName,
    action: 'Approved',
    actionBy: user,
    actionByRole: user.roleName,
    comment,
    previousStatus,
    newStatus: after.status,
  });

  if (after.isFinal) {
    po.status = after.status;
    po.currentApprovalStep = after.currentApprovalStep;
    await po.save();

    await notifyEvent('po.finance.approved', {
      subject: `PO ${po.portalPONumber} fully approved`,
      body: `Purchase Order ${po.portalPONumber} was approved and will be created in SAP.`,
      relatedDocumentType: DOC_TYPE,
      relatedDocumentId: po._id.toString(),
    });

    const sapResult = await createSapPurchaseOrder(po._id.toString(), user);
    const refreshed = await PurchaseOrder.findById(id).lean();
    return { po: sanitizePo(refreshed), sapResult };
  }

  po.status = after.status;
  po.currentApprovalStep = after.currentApprovalStep;
  await po.save();

  await notifyEvent('po.pm.approved', {
    subject: `PO ${po.portalPONumber} approved — pending Finance`,
    body: `Purchase Order ${po.portalPONumber} requires finance approval.`,
    relatedDocumentType: DOC_TYPE,
    relatedDocumentId: po._id.toString(),
  });

  return { po: sanitizePo(po.toObject()), sapResult: null };
}

export async function rejectPurchaseOrder(id, user, { comment, __v } = {}) {
  await connectDB();
  const po = await loadPoForUpdate(id, user);
  const steps = await getApprovalSteps(DOC_TYPE);
  const step = getCurrentStep(steps, po.currentApprovalStep);
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
  if (__v != null && __v !== po.__v) {
    const err = new Error('Document changed');
    err.code = 'VERSION_CONFLICT';
    throw err;
  }

  const previousStatus = po.status;
  po.status = 'Rejected';
  po.currentApprovalStep = 0;
  await po.save();

  await logApprovalHistory({
    documentType: DOC_TYPE,
    documentId: po._id,
    stepName: step.stepName,
    action: 'Rejected',
    actionBy: user,
    actionByRole: user.roleName,
    comment,
    previousStatus,
    newStatus: 'Rejected',
  });

  await notifyEvent('po.rejected', {
    subject: `PO ${po.portalPONumber} rejected`,
    body: `Purchase Order ${po.portalPONumber} was rejected.${comment ? ` Comment: ${comment}` : ''}`,
    relatedDocumentType: DOC_TYPE,
    relatedDocumentId: po._id.toString(),
  });

  return sanitizePo(po.toObject());
}

export async function createSapPoForOrder(id, user) {
  return createSapPurchaseOrder(id, user);
}

export async function retrySapForOrder(id, user) {
  return retrySapPurchaseOrder(id, user);
}
