import '@/models/index.js';
import PurchaseRequest from '@/models/PurchaseRequest.js';
import PurchaseOrder from '@/models/PurchaseOrder.js';
import APReserveInvoice from '@/models/APReserveInvoice.js';
import SapIntegrationLog from '@/models/SapIntegrationLog.js';
import EmailLog from '@/models/EmailLog.js';
import { connectDB } from '@/lib/mongodb';
import { buildPrPendingApprovalFilter } from '@/lib/purchaseRequestsService.js';
import { buildPoPendingApprovalFilter } from '@/lib/purchaseOrdersService.js';
import {
  buildPrVisibilityFilter,
  buildPoVisibilityFilter,
  buildApriVisibilityFilter,
  canViewEmailLogs,
} from '@/lib/visibilityFilters.js';
import { sanitizePr } from '@/lib/purchaseRequestsService.js';
import { sanitizePo } from '@/lib/purchaseOrdersService.js';
import { sanitizeApri } from '@/lib/apReserveInvoicesService.js';

async function mergeFilter(base, extra) {
  if (!base || Object.keys(base).length === 0) return extra;
  if (!extra || Object.keys(extra).length === 0) return base;
  return { $and: [base, extra] };
}

async function countWithFilter(Model, baseFilter, extraFilter = {}) {
  const filter = await mergeFilter(baseFilter, extraFilter);
  return Model.countDocuments(filter);
}

async function accessibleDocumentIds(user) {
  const prFilter = buildPrVisibilityFilter(user);
  const poFilter = buildPoVisibilityFilter(user);
  const apriFilter = buildApriVisibilityFilter(user);
  const [prs, pos, apris] = await Promise.all([
    PurchaseRequest.find(prFilter).select('_id').lean(),
    PurchaseOrder.find(poFilter).select('_id').lean(),
    APReserveInvoice.find(apriFilter).select('_id').lean(),
  ]);
  return [...prs, ...pos, ...apris].map((d) => d._id);
}

export async function getDashboardSummary(user) {
  await connectDB();
  const prBase = buildPrVisibilityFilter(user);
  const poBase = buildPoVisibilityFilter(user);
  const apriBase = buildApriVisibilityFilter(user);

  const prPendingFilter = await buildPrPendingApprovalFilter(user);
  const poPendingFilter = await buildPoPendingApprovalFilter(user);

  const [
    prTotal,
    prPendingApproval,
    prCreatedInSap,
    prFailedSap,
    prRejected,
    poTotal,
    poPendingApproval,
    poCreatedInSap,
    poFailedSap,
    poRejected,
    apriTotal,
    apriCreatedInSap,
    apriFailedSap,
  ] = await Promise.all([
    countWithFilter(PurchaseRequest, prBase),
    countWithFilter(PurchaseRequest, prBase, prPendingFilter),
    countWithFilter(PurchaseRequest, prBase, { status: 'Created in SAP' }),
    countWithFilter(PurchaseRequest, prBase, { status: 'Failed to Create in SAP' }),
    countWithFilter(PurchaseRequest, prBase, { status: 'Rejected' }),
    countWithFilter(PurchaseOrder, poBase),
    countWithFilter(PurchaseOrder, poBase, poPendingFilter),
    countWithFilter(PurchaseOrder, poBase, { status: 'Created in SAP' }),
    countWithFilter(PurchaseOrder, poBase, { status: 'Failed to Create in SAP' }),
    countWithFilter(PurchaseOrder, poBase, { status: 'Rejected' }),
    countWithFilter(APReserveInvoice, apriBase),
    countWithFilter(APReserveInvoice, apriBase, { status: 'Created in SAP' }),
    countWithFilter(APReserveInvoice, apriBase, { status: 'Failed to Create in SAP' }),
  ]);

  let failedIntegrations = 0;
  if (canViewEmailLogs(user)) {
    failedIntegrations = await SapIntegrationLog.countDocuments({ status: 'Failed' });
  } else {
    const docIds = await accessibleDocumentIds(user);
    if (docIds.length) {
      failedIntegrations = await SapIntegrationLog.countDocuments({
        status: 'Failed',
        documentId: { $in: docIds },
      });
    }
  }

  let failedEmails = 0;
  if (canViewEmailLogs(user)) {
    failedEmails = await EmailLog.countDocuments({ emailStatus: 'Failed' });
  }

  return {
    prs: {
      total: prTotal,
      pendingApproval: prPendingApproval,
      createdInSap: prCreatedInSap,
      failedSap: prFailedSap,
      rejected: prRejected,
    },
    pos: {
      total: poTotal,
      pendingApproval: poPendingApproval,
      createdInSap: poCreatedInSap,
      failedSap: poFailedSap,
      rejected: poRejected,
    },
    apri: {
      total: apriTotal,
      createdInSap: apriCreatedInSap,
      failedSap: apriFailedSap,
    },
    sap: { failedIntegrations },
    email: { failedEmails },
  };
}

function sanitizeSapFailure(row) {
  return {
    id: row._id.toString(),
    documentType: row.documentType,
    documentId: row.documentId?.toString(),
    action: row.action,
    status: row.status,
    errorMessage: row.errorMessage,
    sapDocEntry: row.sapDocEntry,
    sapDocNum: row.sapDocNum,
    createdAt: row.createdAt,
  };
}

function sanitizeEmailFailure(row) {
  return {
    id: row._id.toString(),
    eventKey: row.eventKey,
    subject: row.subject,
    emailStatus: row.emailStatus,
    errorMessage: row.errorMessage,
    relatedDocumentType: row.relatedDocumentType,
    relatedDocumentId: row.relatedDocumentId?.toString(),
    sentAt: row.sentAt,
  };
}

export async function getDashboardRecent(user, { limit = 5 } = {}) {
  await connectDB();
  const prFilter = buildPrVisibilityFilter(user);
  const poFilter = buildPoVisibilityFilter(user);
  const apriFilter = buildApriVisibilityFilter(user);

  const [purchaseRequests, purchaseOrders, apReserveInvoices] = await Promise.all([
    PurchaseRequest.find(prFilter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('requester', 'name')
      .lean(),
    PurchaseOrder.find(poFilter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('requester', 'name')
      .lean(),
    APReserveInvoice.find(apriFilter).sort({ createdAt: -1 }).limit(limit).lean(),
  ]);

  let sapFailures = [];
  if (canViewEmailLogs(user)) {
    sapFailures = await SapIntegrationLog.find({ status: 'Failed' })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  } else {
    const docIds = await accessibleDocumentIds(user);
    if (docIds.length) {
      sapFailures = await SapIntegrationLog.find({
        status: 'Failed',
        documentId: { $in: docIds },
      })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
    }
  }

  let emailFailures = [];
  if (canViewEmailLogs(user)) {
    emailFailures = await EmailLog.find({ emailStatus: 'Failed' })
      .sort({ sentAt: -1 })
      .limit(limit)
      .lean();
  }

  return {
    purchaseRequests: purchaseRequests.map(sanitizePr),
    purchaseOrders: purchaseOrders.map(sanitizePo),
    apReserveInvoices: apReserveInvoices.map(sanitizeApri),
    sapFailures: sapFailures.map(sanitizeSapFailure),
    emailFailures: emailFailures.map(sanitizeEmailFailure),
  };
}

/** Status breakdown for optional dashboard charts (tables). */
export async function getDashboardStatusBreakdown(user) {
  await connectDB();
  const prBase = buildPrVisibilityFilter(user);
  const poBase = buildPoVisibilityFilter(user);

  const [prStatuses, poStatuses] = await Promise.all([
    PurchaseRequest.aggregate([
      { $match: prBase },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    PurchaseOrder.aggregate([
      { $match: poBase },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
  ]);

  return {
    prByStatus: prStatuses.map((r) => ({ status: r._id, count: r.count })),
    poByStatus: poStatuses.map((r) => ({ status: r._id, count: r.count })),
  };
}
