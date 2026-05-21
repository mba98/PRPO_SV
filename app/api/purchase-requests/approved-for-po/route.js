import { withAuth } from '@/lib/auth';
import { parseListQuery } from '@/lib/errors';
import { listPrsReadyForPo } from '@/lib/purchaseOrdersService';
import { jsonSuccess, handleServiceError } from '@/lib/apiHelpers';

async function getHandler(request, _ctx, user) {
  try {
    const { page, limit } = parseListQuery(request);
    const { items, pagination } = await listPrsReadyForPo(user, { page, limit });
    return jsonSuccess(items, pagination);
  } catch (err) {
    return handleServiceError(err);
  }
}

export const GET = withAuth(getHandler, ['po.create', 'view.all']);
