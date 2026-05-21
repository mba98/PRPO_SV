import { withAuth } from '@/lib/auth';
import { getSapItem } from '@/lib/sapItems.js';
import { jsonSuccess, handleServiceError, jsonError } from '@/lib/apiHelpers';

async function getHandler(_request, { params }) {
  try {
    const item = await getSapItem(params.itemCode);
    if (!item) {
      return jsonError('Item not found', 'NOT_FOUND', 404);
    }
    return jsonSuccess(item);
  } catch (err) {
    if (err.message?.includes('HANA_CONNECTION_STRING')) {
      const wrapped = new Error('Item lookup is temporarily unavailable');
      wrapped.code = 'HANA_UNAVAILABLE';
      return handleServiceError(wrapped);
    }
    return handleServiceError(err);
  }
}

export const GET = withAuth(getHandler, [
  'pr.create',
  'pr.approve.whs',
  'pr.approve.pm',
  'po.create',
  'view.all',
]);
