import { withAuth } from '@/lib/auth';
import { parseListQuery } from '@/lib/errors';
import { listPurchaseOrders } from '@/lib/purchaseOrdersService';
import { jsonSuccess, handleServiceError } from '@/lib/apiHelpers';

const LIST_PERMS = ['po.create', 'po.approve.pm', 'po.approve.finance', 'view.all'];

async function getHandler(request, _ctx, user) {
  try {
    const { page, limit, sort, order, searchParams } = parseListQuery(request);
    const { items, pagination } = await listPurchaseOrders(user, {
      page,
      limit,
      sort,
      order,
      searchParams,
    });
    return jsonSuccess(items, pagination);
  } catch (err) {
    return handleServiceError(err);
  }
}

export const GET = withAuth(getHandler, LIST_PERMS);
