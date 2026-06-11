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
import {
  sanitizePrListItem,
} from '@/lib/purchaseRequestsService.js';
import { sanitizePoListItem } from '@/lib/purchaseOrdersService.js';
import { sanitizeApriListItem } from '@/lib/apReserveInvoicesService.js';
import { PO_STATUS, poStatusInQuery } from '@/lib/poStatus.js';
import { traceMark } from '@/lib/requestTrace.js';
import { perfAsync } from '@/lib/perfLog.js';

const RECENT_PR_SELECT =
  'portalPRNumber status requester department createdAt currentApprovalStep sapPRDocNum lines';
const RECENT_PO_SELECT =
  'portalPONumber status requester vendor createdAt currentApprovalStep sapPODocNum lines';
const RECENT_APRI_SELECT =
  'portalAPNumber status vendor createdAt currentApprovalStep sapAPDocNum lines';

async function mergeFilter(base, extra) {
  if (!base || Object.keys(base).length === 0) return extra;
  if (!extra || Object.keys(extra).length === 0) return base;
  return { $and: [base, extra] };
}

async function countWithFilter(Model, baseFilter, extraFilter = {}) {
  const filter = await mergeFilter(baseFilter, extraFilter);
  return Model.countDocuments(filter);
}

async function docVisibleToUser(user, row) {
  const permissions = user.permissions || [];
  if (row.documentType === 'PR') {
    const filter = buildPrVisibilityFilter(user);
    if (!Object.keys(filter).length) return true;
    return PurchaseRequest.exists({ _id: row.documentId, ...filter });
  }
  if (row.documentType === 'PO') {
    const filter = buildPoVisibilityFilter(user);
    if (!Object.keys(filter).length) return true;
    return PurchaseOrder.exists({ _id: row.documentId, ...filter });
  }
  if (row.documentType === 'APRI') {
    const filter = buildApriVisibilityFilter(user);
    if (!Object.keys(filter).length) return true;
    return APReserveInvoice.exists({ _id: row.documentId, ...filter });
  }
  return false;
}

/** Bounded scan of recent SAP failures instead of loading all document IDs. */
async function countVisibleSapFailures(user, limit = 100) {
  if (canViewEmailLogs(user)) {
    return SapIntegrationLog.countDocuments({ status: 'Failed' });
  }

  const recent = await SapIntegrationLog.find({ status: 'Failed' })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('documentType documentId')
    .lean();

  let count = 0;
  for (const row of recent) {
    if (await docVisibleToUser(user, row)) count += 1;
  }
  return count;
}

async function listVisibleSapFailures(user, limit = 5) {
  if (canViewEmailLogs(user)) {
    return SapIntegrationLog.find({ status: 'Failed' })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  }

  const recent = await SapIntegrationLog.find({ status: 'Failed' })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  const visible = [];
  for (const row of recent) {
    if (await docVisibleToUser(user, row)) visible.push(row);
    if (visible.length >= limit) break;
  }
  return visible;
}

export async function getDashboardSummary(user) {
  return perfAsync('getDashboardSummary', async () => {
    await connectDB();
    traceMark('db');
    const prBase = buildPrVisibilityFilter(user);
    const poBase = buildPoVisibilityFilter(user);
    const apriBase = buildApriVisibilityFilter(user);

    const [prPendingFilter, poPendingFilter] = await Promise.all([
      buildPrPendingApprovalFilter(user),
      buildPoPendingApprovalFilter(user),
    ]);
    traceMark('matrix');

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
      failedIntegrations,
      failedEmails,
    ] = await Promise.all([
      countWithFilter(PurchaseRequest, prBase),
      countWithFilter(PurchaseRequest, prBase, prPendingFilter),
      countWithFilter(PurchaseRequest, prBase, { status: 'Created in SAP' }),
      countWithFilter(PurchaseRequest, prBase, { status: 'Failed to Create in SAP' }),
      countWithFilter(PurchaseRequest, prBase, { status: 'Rejected' }),
      countWithFilter(PurchaseOrder, poBase),
      countWithFilter(PurchaseOrder, poBase, poPendingFilter),
      countWithFilter(PurchaseOrder, poBase, { status: poStatusInQuery(PO_STATUS.CREATED_IN_SAP) }),
      countWithFilter(PurchaseOrder, poBase, { status: poStatusInQuery(PO_STATUS.FAILED_SAP) }),
      countWithFilter(PurchaseOrder, poBase, { status: poStatusInQuery(PO_STATUS.REJECTED) }),
      countWithFilter(APReserveInvoice, apriBase),
      countWithFilter(APReserveInvoice, apriBase, { status: 'Created in SAP' }),
      countWithFilter(APReserveInvoice, apriBase, { status: 'Failed to Create in SAP' }),
      countVisibleSapFailures(user),
      canViewEmailLogs(user)
        ? EmailLog.countDocuments({ emailStatus: 'Failed' })
        : Promise.resolve(0),
    ]);
    traceMark('query');

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
  });
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
  return perfAsync('getDashboardRecent', async () => {
    await connectDB();
    traceMark('db');
    const prFilter = buildPrVisibilityFilter(user);
    const poFilter = buildPoVisibilityFilter(user);
    const apriFilter = buildApriVisibilityFilter(user);

    const [purchaseRequests, purchaseOrders, apReserveInvoices, sapFailures, emailFailures] =
      await Promise.all([
        PurchaseRequest.find(prFilter)
          .select(RECENT_PR_SELECT)
          .sort({ createdAt: -1 })
          .limit(limit)
          .populate('requester', 'name')
          .lean(),
        PurchaseOrder.find(poFilter)
          .select(RECENT_PO_SELECT)
          .sort({ createdAt: -1 })
          .limit(limit)
          .populate('requester', 'name')
          .lean(),
        APReserveInvoice.find(apriFilter)
          .select(RECENT_APRI_SELECT)
          .sort({ createdAt: -1 })
          .limit(limit)
          .lean(),
        listVisibleSapFailures(user, limit),
        canViewEmailLogs(user)
          ? EmailLog.find({ emailStatus: 'Failed' }).sort({ sentAt: -1 }).limit(limit).lean()
          : Promise.resolve([]),
      ]);
    traceMark('query');

    return {
      purchaseRequests: purchaseRequests.map(sanitizePrListItem),
      purchaseOrders: purchaseOrders.map(sanitizePoListItem),
      apReserveInvoices: apReserveInvoices.map(sanitizeApriListItem),
      sapFailures: sapFailures.map(sanitizeSapFailure),
      emailFailures: emailFailures.map(sanitizeEmailFailure),
    };
  });
}

export async function getDashboardOverview(user, { limit = 5 } = {}) {
  const [summary, recent] = await Promise.all([
    getDashboardSummary(user),
    getDashboardRecent(user, { limit }),
  ]);
  traceMark('serialize');
  return { summary, recent };
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
