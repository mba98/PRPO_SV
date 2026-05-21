import '@/models/index.js';
import PurchaseRequest from '@/models/PurchaseRequest.js';
import PurchaseOrder from '@/models/PurchaseOrder.js';
import { connectDB } from '@/lib/mongodb';
import { buildPagination } from '@/lib/errors';
import { sanitizePr } from '@/lib/purchaseRequestsService';
import { enrichPrForPoList } from '@/lib/prPoReadiness.js';
import { createSapPoFromPr, retrySapPoFromPr } from '@/lib/sap/poFromPrSap.js';

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
      return {
        ...sanitizePr(pr),
        ...meta,
        sapPODocEntry: pr.sapPODocEntry,
        sapPODocNum: pr.sapPODocNum,
        sapPOCreationStatus: pr.sapPOCreationStatus,
        sapPOErrorMessage: pr.sapPOErrorMessage,
      };
    })
    .filter((pr) => pr.poReady);

  const total = enriched.length;
  const start = (page - 1) * limit;
  const items = enriched.slice(start, start + limit);

  return {
    items,
    pagination: buildPagination(page, limit, total),
  };
}

export async function createPurchaseOrderFromPr(prId, user, { vendor }) {
  return createSapPoFromPr(prId, user, { vendor });
}

export async function retryPurchaseOrderFromPr(prId, user, { vendor }) {
  return retrySapPoFromPr(prId, user, { vendor });
}
