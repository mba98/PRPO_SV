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
import { assertPoDocCurrencyAllowedForVendor } from '@/lib/sap/vendorCurrencies.js';
import { createSapPurchaseOrder, retrySapPurchaseOrder } from '@/lib/sap/poSap.js';
import {
  getApprovalSteps,
  getCurrentStep,
  getInitialSubmitState,
  getStateAfterApproval,
  pendingStatusForStep,
} from '@/lib/approvalEngine.js';
import { getEffectivePermissions } from '@/lib/effectivePermissions.js';
import { logApprovalHistory, getApprovalHistory } from '@/lib/auditHistory.js';
import ApprovalHistory from '@/models/ApprovalHistory.js';
import { notifyWorkflowEmailSafe } from '@/lib/emailNotify.js';
import { buildPoEmailContext } from '@/lib/emailContext.js';
import { loadPoWorkflow } from '@/lib/workflowSteps.js';
import { assertUserCanApproveDocument, buildDocumentApprovalAccess } from '@/lib/documentApprovalAuth.js';
import { assertImplementedCompletionPolicy } from '@/lib/approvalPolicies.js';
import {
  assertApprovalVersionMatches,
  atomicDocumentStepTransition,
  buildAtomicStepFilter,
  logStepApprovalHistory,
  rejectedStatusForDocumentType,
} from '@/lib/approvalTransition.js';
import { buildApprovalActionResult } from '@/lib/approvalActionResponse.js';
import { PO_LIST_SELECT, lineCount } from '@/lib/listFields.js';
import { perfAsync } from '@/lib/perfLog.js';
import { traceMark } from '@/lib/requestTrace.js';
import { canEditPurchaseOrder, canResubmitPurchaseOrder, getPoEditForbiddenMessage } from '@/lib/poEditPermissions.js';
import { resolveLineUomCode } from '@/lib/sap/uomCode.js';
import {
  userCanAccessPoWorkflow,
  userHasAnyPoApprovalPermission,
} from '@/lib/poPermissions.js';
import {
  canUserRetrySapDocument,
  isDocumentEligibleForSapRetry,
} from '@/lib/sapRetryAuth.js';
import {
  hasAnyApprovedApprovalStep,
  PO_EDIT_FORBIDDEN_MESSAGE,
} from '@/lib/poEditPermissions.js';
import {
  PO_STATUS,
  isPendingPoApprovalStatus,
  poStatusInQuery,
  poStatusesEqual,
} from '@/lib/poStatus.js';

const DOC_TYPE = 'PO';
const LIST_PERMS = ['po.create', 'po.approve.pm', 'po.approve.om', 'po.approve.finance', 'view.all'];

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

export function sanitizePoListItem(doc) {
  const base = sanitizePo(doc);
  if (!base) return null;
  const { lines, ...rest } = base;
  return { ...rest, lineCount: lineCount(doc) };
}

function userCanViewPo(user, po) {
  const permissions = getEffectivePermissions(user);
  if (permissions.includes('view.all')) return true;
  const requesterId = po.requester?._id?.toString() || po.requester?.toString();
  if (requesterId === user._id.toString()) return true;
  if (isPendingPoApprovalStatus(po.status)) {
    return userHasAnyPoApprovalPermission(permissions) || permissions.includes('po.create');
  }
  return userCanAccessPoWorkflow(permissions);
}

export async function buildPoPendingApprovalFilter(user) {
  const steps = await getApprovalSteps('PO');
  const permissions = getEffectivePermissions(user);

  if (permissions.includes('view.all')) {
    const statuses = steps.map((s) => pendingStatusForStep(s, 'PO'));
    return { status: poStatusInQuery(...statuses) };
  }

  const or = [];
  for (const step of steps) {
    if (permissions.includes(step.requiredPermission)) {
      or.push({
        status: poStatusInQuery(pendingStatusForStep(step, 'PO')),
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
    const canApprove = userHasAnyPoApprovalPermission(permissions) || permissions.includes('view.all');
    if (canApprove) {
      Object.assign(filter, await buildPoPendingApprovalFilter(user));
    } else if (permissions.includes('po.create')) {
      const steps = await getApprovalSteps('PO');
      filter.status = poStatusInQuery(...steps.map((s) => pendingStatusForStep(s, 'PO')));
    } else {
      filter._id = null;
    }
  } else if (tab === 'approved') {
    filter.status = poStatusInQuery(
      PO_STATUS.APPROVED,
      PO_STATUS.CREATING_IN_SAP,
      PO_STATUS.CREATED_IN_SAP,
    );
    if (!permissions.includes('view.all') && !permissions.includes('po.create')) {
      filter.requester = user._id;
    }
  } else if (tab === 'failed-sap') {
    filter.status = poStatusInQuery(PO_STATUS.FAILED_SAP);
    if (
      !permissions.includes('view.all') &&
      !permissions.includes('admin.settings') &&
      !permissions.includes('po.create') &&
      !userHasAnyPoApprovalPermission(permissions)
    ) {
      filter.requester = user._id;
    }
  } else if (tab === 'rejected') {
    filter.status = poStatusInQuery(PO_STATUS.REJECTED);
    if (
      !permissions.includes('view.all') &&
      !permissions.includes('po.create') &&
      !userHasAnyPoApprovalPermission(permissions)
    ) {
      filter.requester = user._id;
    }
  } else if (tab === 'sap') {
    filter.status = poStatusInQuery(PO_STATUS.CREATED_IN_SAP);
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
  return perfAsync('listPurchaseOrders', async () => {
    await connectDB();
    const tab = searchParams.get('tab') || 'pending';
    const filter = await buildListFilter(user, { searchParams, tab });
    const sortDir = order === 'asc' ? 1 : -1;
    const sortField = resolveSortField(sort, PO_SORT_FIELDS);

    const [total, rows] = await Promise.all([
      PurchaseOrder.countDocuments(filter),
      PurchaseOrder.find(filter)
        .select(PO_LIST_SELECT)
        .populate('requester', 'name email')
        .sort({ [sortField]: sortDir })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    return {
      items: rows.map(sanitizePoListItem),
      pagination: buildPagination(page, limit, total),
    };
  });
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
  return perfAsync('listPrsReadyForPo', async () => {
    await connectDB();
    traceMark('db');

    const linkedPrIds = await PurchaseOrder.distinct('relatedPRId', {
      relatedPRId: { $exists: true, $ne: null },
      status: { $nin: poStatusInQuery(PO_STATUS.REJECTED).$in },
    });

    const noPortalPoYet = {
      $and: [
        {
          $or: [
            { relatedPortalPONumber: { $exists: false } },
            { relatedPortalPONumber: null },
            { relatedPortalPONumber: '' },
          ],
        },
        {
          $or: [{ relatedPOId: { $exists: false } }, { relatedPOId: null }],
        },
        {
          $or: [
            { relatedPONumber: { $exists: false } },
            { relatedPONumber: null },
            { relatedPONumber: '' },
          ],
        },
        {
          $or: [{ relatedSAPPODocEntry: { $exists: false } }, { relatedSAPPODocEntry: null }],
        },
        {
          $or: [
            { relatedSAPPODocNum: { $exists: false } },
            { relatedSAPPODocNum: null },
            { relatedSAPPODocNum: '' },
          ],
        },
      ],
    };

    const filter = {
      $and: [buildReadyForPoPrFilter(), noPortalPoYet],
    };

    if (linkedPrIds.length > 0) {
      filter._id = { $nin: linkedPrIds };
    }

    const permissions = getEffectivePermissions(user);
    if (!permissions.includes('view.all') && !permissions.includes('po.create')) {
      filter.requester = user._id;
    }

    const [total, rows] = await Promise.all([
      PurchaseRequest.countDocuments(filter),
      PurchaseRequest.find(filter)
        .select(
          'portalPRNumber status requester requesterEmail department project warehouse sapPRDocNum sapPRDocEntry relatedPortalPONumber relatedPOId relatedPONumber relatedSAPPODocEntry relatedSAPPODocNum createdAt lines',
        )
        .populate('requester', 'name email')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);
    traceMark('query');

    const prIds = rows.map((r) => r._id);
    const orders =
      prIds.length > 0
        ? await PurchaseOrder.find({ relatedPRId: { $in: prIds } })
            .select('relatedPRId portalPONumber vendor status sapPODocEntry sapPODocNum')
            .lean()
        : [];

    return {
      items: rows.map((pr) => {
        const meta = enrichPrForPoList(pr, orders);
        return { ...sanitizePr(pr), ...meta };
      }),
      pagination: buildPagination(page, limit, total),
    };
  });
}

function getLatestRejectionFromHistory(history = []) {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (history[i].action === 'Rejected') {
      return {
        reason: history[i].comment || null,
        rejectedBy: history[i].actionByName || history[i].actionBy?.name || null,
        stepName: history[i].stepName || null,
      };
    }
  }
  return null;
}

function userIsProcurement(user) {
  return getEffectivePermissions(user).includes('po.create');
}

export async function getPurchaseOrderById(id, user) {
  return perfAsync(`getPurchaseOrderById ${id}`, async () => {
    await connectDB();
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    const po = await PurchaseOrder.findById(id).populate('requester', 'name email').lean();
    if (!po) return null;
    if (!userCanViewPo(user, po)) {
      const err = new Error('Forbidden');
      err.code = 'FORBIDDEN';
      throw err;
    }

    const [workflowSteps, hasApprovedStep, matrixSteps, approvalHistory] = await Promise.all([
      loadPoWorkflow(po, user),
      ApprovalHistory.exists({
        documentType: DOC_TYPE,
        documentId: id,
        action: 'Approved',
      }),
      getApprovalSteps('PO'),
      getApprovalHistory(DOC_TYPE, id),
    ]);
    const sanitized = sanitizePo(po);
    const approvalAccess = buildDocumentApprovalAccess({
      documentType: 'PO',
      document: sanitized,
      user,
      approvalSteps: matrixSteps,
    });
    const approvalHistoryStub = hasApprovedStep ? [{ action: 'Approved' }] : approvalHistory;
    const canEdit = canEditPurchaseOrder(user, po, approvalHistoryStub);
    const canRetrySap =
      isDocumentEligibleForSapRetry(po, 'PO') &&
      canUserRetrySapDocument({
        user,
        documentType: 'PO',
        document: po,
        approvalSteps: matrixSteps,
        approvalHistory,
      });
    const rejection = getLatestRejectionFromHistory(approvalHistory);
    const procurement = userIsProcurement(user);
    return {
      ...sanitized,
      workflowSteps,
      ...approvalAccess,
      canEdit,
      canResubmit: canResubmitPurchaseOrder(user, po, approvalHistoryStub),
      canRetrySap,
      showEditLockedMessage:
        procurement &&
        !canEdit &&
        !po.sapPODocEntry &&
        !poStatusesEqual(po.status, PO_STATUS.REJECTED) &&
        hasAnyApprovedApprovalStep(approvalHistoryStub),
      editLockedMessage: PO_EDIT_FORBIDDEN_MESSAGE,
      rejectionReason: rejection?.reason || null,
      rejectionStepName: rejection?.stepName || null,
      rejectedByName: rejection?.rejectedBy || null,
    };
  });
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

export async function createPurchaseOrderFromPr(prId, user, body) {
  return createPortalPoFromPr(prId, user, body);
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
  const history = await getApprovalHistory(DOC_TYPE, id);
  const denialMessage = getPoEditForbiddenMessage(user, po.toObject(), history);
  if (denialMessage) {
    const err = new Error(denialMessage);
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
  if (data.docCurrency != null || data.vendor != null) {
    const vendorCode = (data.vendor ?? po.vendor ?? '').trim();
    const currencyToValidate = data.docCurrency ?? po.docCurrency;
    if (vendorCode && currencyToValidate) {
      try {
        const { currency } = await assertPoDocCurrencyAllowedForVendor(vendorCode, currencyToValidate);
        po.docCurrency = currency;
      } catch (err) {
        const validationErr = new Error(err.message || 'Selected currency is not allowed for this Vendor');
        validationErr.code = err.code || 'INVALID_CURRENCY';
        throw validationErr;
      }
    } else if (data.docCurrency != null) {
      po.docCurrency = data.docCurrency;
    }
  }
  const effectiveCurrency = po.docCurrency;
  if (effectiveCurrency === 'IQD') {
    po.docRate = undefined;
  } else if (data.docRate === null || data.docRate === '') {
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
  assertUserCanApproveDocument({
    documentType: 'PO',
    document: po.toObject(),
    user,
    approvalSteps: steps,
    step,
    action: 'approve',
  });
  assertImplementedCompletionPolicy(step);
  assertApprovalVersionMatches(po, __v);

  const previousStatus = po.status;
  const after = getStateAfterApproval(steps, po.currentApprovalStep, DOC_TYPE);

  const updated = await atomicDocumentStepTransition(
    PurchaseOrder,
    buildAtomicStepFilter(po, __v),
    {
      status: after.status,
      currentApprovalStep: after.currentApprovalStep,
    },
  );

  await logStepApprovalHistory({
    documentType: DOC_TYPE,
    documentId: po._id,
    step,
    action: 'Approved',
    user,
    comment,
    previousStatus,
    newStatus: after.status,
  });

  if (after.isFinal) {
    notifyWorkflowEmailSafe(
      'po.finance.approved',
      {
        ...buildPoEmailContext(updated),
        status: 'Approved — SAP creation has started',
      },
      { documentType: DOC_TYPE, documentId: updated._id.toString() },
    );

    const sapResult = await createSapPurchaseOrder(updated._id.toString(), user);
    const refreshed = await PurchaseOrder.findById(id).lean();
    return buildApprovalActionResult('PO', sanitizePo(refreshed), user, {
      message: 'Approved successfully',
      sapResult,
    });
  }

  const emailEvent =
    step.requiredPermission === 'po.approve.pm' ? 'po.pm.approved' : 'po.om.approved';
  notifyWorkflowEmailSafe(
    emailEvent,
    {
      ...buildPoEmailContext(updated),
      status: after.status,
    },
    { documentType: DOC_TYPE, documentId: updated._id.toString() },
  );

  return buildApprovalActionResult('PO', sanitizePo(updated.toObject()), user, {
    message: 'Approved successfully',
    sapResult: null,
  });
}

export async function resubmitPurchaseOrder(id, user, { __v } = {}) {
  await connectDB();
  const po = await loadPoForUpdate(id, user);
  const history = await getApprovalHistory(DOC_TYPE, id);
  if (!canResubmitPurchaseOrder(user, po.toObject(), history)) {
    const denialMessage = getPoEditForbiddenMessage(user, po.toObject(), history);
    const err = new Error(denialMessage || 'You do not have permission to resubmit this purchase order');
    err.code = 'FORBIDDEN';
    throw err;
  }
  if (!poStatusesEqual(po.status, PO_STATUS.REJECTED)) {
    const err = new Error('Only rejected purchase orders can be resubmitted');
    err.code = 'INVALID_STATUS';
    throw err;
  }
  if (__v != null && __v !== po.__v) {
    const err = new Error('Document changed');
    err.code = 'VERSION_CONFLICT';
    throw err;
  }
  const steps = await getApprovalSteps(DOC_TYPE);
  const next = getInitialSubmitState(steps, DOC_TYPE);
  const previousStatus = po.status;
  po.status = next.status;
  po.currentApprovalStep = next.currentApprovalStep;
  await po.save();

  await logApprovalHistory({
    documentType: DOC_TYPE,
    documentId: po._id,
    stepName: 'Resubmit',
    action: 'Resubmitted',
    actionBy: user,
    actionByRole: user.roleName,
    previousStatus,
    newStatus: po.status,
  });

  notifyWorkflowEmailSafe(
    'po.created',
    {
      ...buildPoEmailContext(po.toObject()),
      status: po.status,
    },
    { documentType: DOC_TYPE, documentId: po._id.toString() },
  );

  return sanitizePo(po.toObject());
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
  assertUserCanApproveDocument({
    documentType: 'PO',
    document: po.toObject(),
    user,
    approvalSteps: steps,
    step,
    action: 'reject',
  });
  assertImplementedCompletionPolicy(step);
  assertApprovalVersionMatches(po, __v);

  const previousStatus = po.status;
  const rejectedStatus = rejectedStatusForDocumentType(DOC_TYPE);

  const updated = await atomicDocumentStepTransition(
    PurchaseOrder,
    buildAtomicStepFilter(po, __v),
    {
      status: rejectedStatus,
      currentApprovalStep: 0,
    },
  );

  await logStepApprovalHistory({
    documentType: DOC_TYPE,
    documentId: po._id,
    step,
    action: 'Rejected',
    user,
    comment,
    previousStatus,
    newStatus: rejectedStatus,
  });

  notifyWorkflowEmailSafe(
    'po.rejected',
    {
      ...buildPoEmailContext(updated),
      status: rejectedStatus,
      comment,
    },
    { documentType: DOC_TYPE, documentId: updated._id.toString() },
  );

  return buildApprovalActionResult('PO', sanitizePo(updated.toObject()), user, {
    message: 'Rejected successfully',
    sapResult: null,
  });
}

export async function createSapPoForOrder(id, user) {
  return createSapPurchaseOrder(id, user);
}

export async function retrySapForOrder(id, user) {
  await connectDB();
  const po = await PurchaseOrder.findById(id).lean();
  if (!po) {
    const err = new Error('Purchase order not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  const [matrixSteps, approvalHistory] = await Promise.all([
    getApprovalSteps(DOC_TYPE),
    getApprovalHistory(DOC_TYPE, id),
  ]);
  if (
    !canUserRetrySapDocument({
      user,
      documentType: 'PO',
      document: po,
      approvalSteps: matrixSteps,
      approvalHistory,
    })
  ) {
    const err = new Error('You do not have permission to retry SAP creation');
    err.code = 'FORBIDDEN';
    throw err;
  }
  return retrySapPurchaseOrder(id, user);
}
