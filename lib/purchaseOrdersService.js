import mongoose from 'mongoose';
import '@/models/index.js';
import PurchaseOrder from '@/models/PurchaseOrder.js';
import PurchaseRequest from '@/models/PurchaseRequest.js';
import { connectDB } from '@/lib/mongodb';
import { buildPagination } from '@/lib/errors';
import { PO_SORT_FIELDS, resolveSortField } from '@/lib/listQuery.js';
import { sanitizePr } from '@/lib/purchaseRequestsService';
import {
  buildReadyForPoPrFilter,
  enrichPrForPoList,
  prIsEligibleForReadyForPoList,
} from '@/lib/prPoReadiness.js';
import { createPortalPoFromPr } from '@/lib/sap/poFromPrSap.js';
import { createSapPurchaseOrder, retrySapPurchaseOrder } from '@/lib/sap/poSap.js';
import {
  getApprovalSteps,
  getCurrentStep,
  getStateAfterApproval,
  pendingStatusForStep,
  userCanApproveStep,
} from '@/lib/approvalEngine.js';
import { getEffectivePermissions } from '@/lib/effectivePermissions.js';
import { logApprovalHistory, getApprovalHistory } from '@/lib/auditHistory.js';
import { notifyWorkflowEmailSafe } from '@/lib/emailNotify.js';
import { buildPoEmailContext } from '@/lib/emailContext.js';
import { canApproveCurrentWorkflowStep, loadPoWorkflow } from '@/lib/workflowSteps.js';
import { listAttachments } from '@/lib/attachmentsService.js';
import { canEditPurchaseOrder } from '@/lib/poEditPermissions.js';
import { resolveLineUomCode } from '@/lib/sap/uomCode.js';
import { canRetrySapPurchaseOrder } from '@/lib/poPermissions.js';

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
    dueDate: doc.dueDate,
    postingDate: doc.postingDate,
    documentDate: doc.documentDate,
    docRate: doc.docRate,
    remarks: doc.remarks,
    status: doc.status,
    currentApprovalStep: doc.currentApprovalStep,
    sapPODocEntry: doc.sapPODocEntry,
    sapPODocNum: doc.sapPODocNum,
    sapCreationStatus: doc.sapCreationStatus,
    sapPOStatus: doc.sapPOStatus,
    sapCreatedAt: doc.sapCreatedAt,
    sapWarnings: doc.sapWarnings,
    sapErrorMessage: doc.sapErrorMessage,
    docCurrency: doc.docCurrency,
    lines: doc.lines || [],
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    __v: doc.__v,
  };
}

function userCanViewPo(user, po) {
  const permissions = getEffectivePermissions(user);
  if (permissions.includes('view.all')) return true;
  const requesterId = po.requester?._id?.toString() || po.requester?.toString();
  if (requesterId === user._id.toString()) return true;
  if (
    ['Pending Project Manager Approval', 'Pending Finance Approval'].includes(po.status)
  ) {
    return (
      permissions.includes('po.approve.pm') ||
      permissions.includes('po.approve.finance') ||
      permissions.includes('po.create')
    );
  }
  return permissions.some((p) => LIST_PERMS.includes(p));
}

export async function buildPoPendingApprovalFilter(user) {
  const steps = await getApprovalSteps('PO');
  const permissions = getEffectivePermissions(user);

  if (permissions.includes('view.all')) {
    const statuses = steps.map((s) => pendingStatusForStep(s, 'PO'));
    return { status: { $in: statuses } };
  }

  const or = [];
  for (const step of steps) {
    if (permissions.includes(step.requiredPermission)) {
      or.push({
        status: pendingStatusForStep(step, 'PO'),
        currentApprovalStep: step.stepOrder,
      });
    }
  }
  return or.length ? { $or: or } : { _id: null };
}

async function buildListFilter(user, { searchParams, tab }) {
  const permissions = getEffectivePermissions(user);
  const filter = {};
  if (tab === 'pending') {
    const canApprove =
      permissions.includes('po.approve.pm') ||
      permissions.includes('po.approve.finance') ||
      permissions.includes('view.all');
    if (canApprove) {
      Object.assign(filter, await buildPoPendingApprovalFilter(user));
    } else if (permissions.includes('po.create')) {
      const steps = await getApprovalSteps('PO');
      filter.status = {
        $in: steps.map((s) => pendingStatusForStep(s, 'PO')),
      };
    } else {
      filter._id = null;
    }
  } else if (tab === 'approved') {
    filter.status = {
      $in: ['Approved', 'Creating in SAP', 'Created in SAP', 'Failed to Create in SAP'],
    };
    if (!permissions.includes('view.all') && !permissions.includes('po.create')) {
      filter.requester = user._id;
    }
  } else if (tab === 'rejected') {
    filter.status = 'Rejected';
    if (
      !permissions.includes('view.all') &&
      !permissions.includes('po.create') &&
      !permissions.includes('po.approve.pm') &&
      !permissions.includes('po.approve.finance')
    ) {
      filter.requester = user._id;
    }
  } else if (tab === 'sap') {
    filter.status = 'Created in SAP';
    if (!permissions.includes('view.all') && !permissions.includes('po.create')) {
      filter.requester = user._id;
    }
  } else if (tab === 'all') {
    if (!permissions.includes('view.all')) {
      const err = new Error('Forbidden');
      err.code = 'FORBIDDEN';
      throw err;
    }
  } else if (!permissions.includes('view.all') && !permissions.includes('po.create')) {
    filter.requester = user._id;
  }

  const portalPONumber = searchParams.get('portalPONumber');
  if (portalPONumber) filter.portalPONumber = { $regex: portalPONumber, $options: 'i' };
  const relatedPRNumber = searchParams.get('relatedPRNumber');
  if (relatedPRNumber) filter.relatedPRNumber = { $regex: relatedPRNumber, $options: 'i' };
  const sapPODocNum = searchParams.get('sapPODocNum');
  if (sapPODocNum) filter.sapPODocNum = { $regex: sapPODocNum, $options: 'i' };
  const vendor = searchParams.get('vendor');
  if (vendor) filter.vendor = { $regex: vendor, $options: 'i' };
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
        { portalPONumber: { $regex: q, $options: 'i' } },
        { relatedPRNumber: { $regex: q, $options: 'i' } },
        { sapPODocNum: { $regex: q, $options: 'i' } },
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

export async function listPurchaseOrders(user, { page, limit, sort, order, searchParams }) {
  await connectDB();
  const tab = searchParams.get('tab') || 'pending';
  const filter = await buildListFilter(user, { searchParams, tab });
  const sortDir = order === 'asc' ? 1 : -1;
  const sortField = resolveSortField(sort, PO_SORT_FIELDS);

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

export async function fetchPurchaseOrdersForExport(user, { searchParams, sort, order, limit }) {
  await connectDB();
  const tab = searchParams.get('tab') || 'pending';
  const filter = await buildListFilter(user, { searchParams, tab });
  const sortDir = order === 'asc' ? 1 : -1;
  const sortField = resolveSortField(sort, PO_SORT_FIELDS);
  const rows = await PurchaseOrder.find(filter)
    .populate('requester', 'name email')
    .sort({ [sortField]: sortDir })
    .limit(limit)
    .lean();
  return rows.map(sanitizePo);
}

export async function listPrsReadyForPo(user, { page, limit }) {
  await connectDB();

  const linkedPrIds = await PurchaseOrder.distinct('relatedPRId', {
    relatedPRId: { $exists: true, $ne: null },
    status: { $ne: 'Rejected' },
  });

  const filter = buildReadyForPoPrFilter();
  if (linkedPrIds.length > 0) {
    filter._id = { $nin: linkedPrIds };
  }

  const permissions = getEffectivePermissions(user);
  if (!permissions.includes('view.all') && !permissions.includes('po.create')) {
    filter.requester = user._id;
  }

  const rows = await PurchaseRequest.find(filter)
    .populate('requester', 'name email')
    .sort({ createdAt: -1 })
    .lean();

  const prIds = rows.map((r) => r._id);
  const orders =
    prIds.length > 0
      ? await PurchaseOrder.find({ relatedPRId: { $in: prIds } }).lean()
      : [];

  const enriched = rows
    .filter((pr) => prIsEligibleForReadyForPoList(pr, orders))
    .map((pr) => {
      const meta = enrichPrForPoList(pr, orders);
      return { ...sanitizePr(pr), ...meta };
    });

  const total = enriched.length;
  const start = (page - 1) * limit;
  return {
    items: enriched.slice(start, start + limit),
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
  const [history, attachments, workflowSteps] = await Promise.all([
    getApprovalHistory(DOC_TYPE, id),
    listAttachments(DOC_TYPE, id),
    loadPoWorkflow(po, user),
  ]);
  const sanitized = sanitizePo(po);
  const currentWorkflowStep = workflowSteps.find((s) => s.state === 'current');
  return {
    ...sanitized,
    workflowSteps,
    canApproveCurrentStep: canApproveCurrentWorkflowStep(workflowSteps),
    canRejectCurrentStep: canApproveCurrentWorkflowStep(workflowSteps),
    currentStepName: currentWorkflowStep?.stepName || null,
    currentStepRequiredPermission: currentWorkflowStep?.requiredPermission || null,
    canEdit: canEditPurchaseOrder(user, po),
    canRetrySap:
      po.status === 'Failed to Create in SAP' &&
      !po.sapPODocEntry &&
      canRetrySapPurchaseOrder(user),
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

function parsePoDate(value) {
  if (!value) return undefined;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function normalizePoLines(lines = []) {
  return lines.map((line) => {
    const qty = line.quantity;
    const unit = line.unitPrice;
    let lineTotal = line.lineTotal;
    if (lineTotal == null && unit != null && qty != null) {
      lineTotal = unit * qty;
    }
    return {
      ...line,
      uomCode: resolveLineUomCode(line) || undefined,
      lineTotal,
    };
  });
}

export async function updatePurchaseOrder(id, data, user) {
  await connectDB();
  const po = await loadPoForUpdate(id, user);
  if (!canEditPurchaseOrder(user, po.toObject())) {
    const err = new Error('You do not have permission to edit this purchase order');
    err.code = 'FORBIDDEN';
    throw err;
  }
  if (data.__v != null && data.__v !== po.__v) {
    const err = new Error('Document changed');
    err.code = 'VERSION_CONFLICT';
    throw err;
  }

  if (data.vendor != null) po.vendor = data.vendor.trim();
  if (data.remarks != null) po.remarks = data.remarks;
  if (data.postingDate != null) po.postingDate = parsePoDate(data.postingDate);
  if (data.documentDate != null) po.documentDate = parsePoDate(data.documentDate);
  if (data.requiredDate != null) po.requiredDate = parsePoDate(data.requiredDate);
  if (data.dueDate != null) po.dueDate = parsePoDate(data.dueDate);
  if (data.docRate === null || data.docRate === '') {
    po.docRate = undefined;
  } else if (data.docRate != null) {
    po.docRate = data.docRate;
  }

  if (data.lines) {
    po.lines = normalizePoLines(data.lines).map((line, index) => {
      const existing = line._id
        ? po.lines.id(line._id) || po.lines[index]
        : po.lines[index];
      return {
        relatedPRLineId: existing?.relatedPRLineId,
        sapPRBaseLine: existing?.sapPRBaseLine,
        itemCode: line.itemCode,
        itemName: line.itemName ?? existing?.itemName,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        lineTotal: line.lineTotal,
        uom: line.uom ?? existing?.uom,
        uomCode: line.uomCode,
        warehouseCode: line.warehouseCode ?? existing?.warehouseCode,
        projectCode: line.projectCode ?? existing?.projectCode,
        costCenter: line.costCenter ?? existing?.costCenter,
        remarks: line.remarks,
        uDepartment: existing?.uDepartment,
        uDelDate: existing?.uDelDate,
        uRate: existing?.uRate,
        _id: existing?._id,
      };
    });
    po.markModified('lines');
  }

  await po.save();

  await logApprovalHistory({
    documentType: DOC_TYPE,
    documentId: po._id,
    stepName: 'Edit',
    action: 'Updated',
    actionBy: user,
    actionByRole: user.roleName,
    previousStatus: po.status,
    newStatus: po.status,
    comment: 'Purchase order updated',
  });

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

    notifyWorkflowEmailSafe(
      'po.finance.approved',
      {
        ...buildPoEmailContext(po),
        status: 'Approved — creating in SAP',
      },
      { documentType: DOC_TYPE, documentId: po._id.toString() },
    );

    const sapResult = await createSapPurchaseOrder(po._id.toString(), user);
    const refreshed = await PurchaseOrder.findById(id).lean();
    return { po: sanitizePo(refreshed), sapResult };
  }

  po.status = after.status;
  po.currentApprovalStep = after.currentApprovalStep;
  await po.save();

  notifyWorkflowEmailSafe(
    'po.pm.approved',
    {
      ...buildPoEmailContext(po),
      status: after.status,
    },
    { documentType: DOC_TYPE, documentId: po._id.toString() },
  );

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

  notifyWorkflowEmailSafe(
    'po.rejected',
    {
      ...buildPoEmailContext(po),
      status: 'Rejected',
      comment,
    },
    { documentType: DOC_TYPE, documentId: po._id.toString() },
  );

  return sanitizePo(po.toObject());
}

export async function createSapPoForOrder(id, user) {
  return createSapPurchaseOrder(id, user);
}

export async function retrySapForOrder(id, user) {
  if (!canRetrySapPurchaseOrder(user)) {
    const err = new Error('You do not have permission to retry SAP creation');
    err.code = 'FORBIDDEN';
    throw err;
  }
  return retrySapPurchaseOrder(id, user);
}
