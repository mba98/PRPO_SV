import '@/models/index.js';
import PurchaseRequest from '@/models/PurchaseRequest.js';
import PurchaseOrder from '@/models/PurchaseOrder.js';
import APReserveInvoice from '@/models/APReserveInvoice.js';
import { connectDB } from '@/lib/mongodb';
import { cacheGet, cacheSet, cacheDelete } from '@/lib/memoryCache.js';
import { getEffectivePermissions } from '@/lib/effectivePermissions.js';
import { buildPrPendingApprovalFilter } from '@/lib/purchaseRequestsService.js';
import { buildPoPendingApprovalFilter } from '@/lib/purchaseOrdersService.js';
import { buildApriPendingApprovalFilter } from '@/lib/apriPermissions.js';
import { buildReadyForPoPrFilter } from '@/lib/prPoReadiness.js';
import { PO_STATUS, poStatusInQuery } from '@/lib/poStatus.js';
import { traceMark } from '@/lib/requestTrace.js';

const NAV_COUNTS_TTL_MS = 30_000;

function cacheKey(user) {
  return `nav-counts:${user._id?.toString() || 'anon'}`;
}

async function mergeCount(Model, base, extra) {
  if (!extra || !Object.keys(extra).length) {
    return Model.countDocuments(base);
  }
  if (!base || !Object.keys(base).length) {
    return Model.countDocuments(extra);
  }
  return Model.countDocuments({ $and: [base, extra] });
}

async function countReadyForPo(user) {
  const linkedPrIds = await PurchaseOrder.distinct('relatedPRId', {
    relatedPRId: { $exists: true, $ne: null },
    status: { $nin: poStatusInQuery(PO_STATUS.REJECTED).$in },
  });

  const filter = {
    ...buildReadyForPoPrFilter(),
    $or: [
      { relatedPortalPONumber: { $exists: false } },
      { relatedPortalPONumber: null },
      { relatedPortalPONumber: '' },
    ],
  };

  if (linkedPrIds.length) {
    filter._id = { $nin: linkedPrIds };
  }

  const permissions = getEffectivePermissions(user);
  if (!permissions.includes('view.all') && !permissions.includes('po.create')) {
    filter.requester = user._id;
  }

  return PurchaseRequest.countDocuments(filter);
}

async function countReadyForApri(user) {
  const baseFilter = {
    status: poStatusInQuery(PO_STATUS.CREATED_IN_SAP),
    sapPODocEntry: { $exists: true, $ne: null },
  };

  const permissions = getEffectivePermissions(user);
  if (!permissions.includes('view.all') && !permissions.includes('apinvoice.create')) {
    baseFilter.requester = user._id;
  }

  const occupiedPoIds = await APReserveInvoice.distinct('relatedPOId');
  const filter =
    occupiedPoIds.length > 0
      ? { ...baseFilter, _id: { $nin: occupiedPoIds } }
      : baseFilter;

  return PurchaseOrder.countDocuments(filter);
}

export async function getNavigationCounts(user) {
  const key = cacheKey(user);
  const cached = cacheGet(key);
  if (cached) return cached;

  await connectDB();
  traceMark('db');

  const [prPendingFilter, poPendingFilter, apriPendingFilter] = await Promise.all([
    buildPrPendingApprovalFilter(user),
    buildPoPendingApprovalFilter(user),
    buildApriPendingApprovalFilter(user),
  ]);
  traceMark('matrix');

  const permissions = getEffectivePermissions(user);
  const counts = {
    pendingPr: 0,
    pendingPo: 0,
    pendingApri: 0,
    readyForPo: 0,
    readyForApri: 0,
  };

  const tasks = [];

  if (
    permissions.includes('pr.approve.whs') ||
    permissions.includes('pr.approve.pm') ||
    permissions.includes('view.all')
  ) {
    tasks.push(
      mergeCount(PurchaseRequest, {}, prPendingFilter).then((n) => {
        counts.pendingPr = n;
      }),
    );
  }

  if (
    permissions.some((p) =>
      ['po.approve.pm', 'po.approve.om', 'po.approve.finance', 'view.all', 'po.create'].includes(p),
    )
  ) {
    tasks.push(
      mergeCount(PurchaseOrder, {}, poPendingFilter).then((n) => {
        counts.pendingPo = n;
      }),
    );
  }

  if (
    permissions.includes('pr.approve.whs') ||
    permissions.includes('apinvoice.create') ||
    permissions.includes('view.all')
  ) {
    tasks.push(
      mergeCount(APReserveInvoice, {}, apriPendingFilter).then((n) => {
        counts.pendingApri = n;
      }),
    );
  }

  if (permissions.includes('po.create') || permissions.includes('view.all')) {
    tasks.push(countReadyForPo(user).then((n) => {
      counts.readyForPo = n;
    }));
  }

  if (permissions.includes('apinvoice.create') || permissions.includes('view.all')) {
    tasks.push(countReadyForApri(user).then((n) => {
      counts.readyForApri = n;
    }));
  }

  await Promise.all(tasks);
  traceMark('query');

  cacheSet(key, counts, NAV_COUNTS_TTL_MS);
  return counts;
}

export function invalidateNavigationCountsCache(userId) {
  if (!userId) return;
  cacheDelete(`nav-counts:${userId.toString()}`);
}
