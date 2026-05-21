import { withAuth } from '@/lib/auth';
import { searchSapItems } from '@/lib/sapItems.js';
import { jsonSuccess, handleServiceError } from '@/lib/apiHelpers';

async function getHandler(request) {
  try {
    const query = new URL(request.url).searchParams.get('query') || '';
    if (!query.trim()) {
      return jsonSuccess([]);
    }
    const items = await searchSapItems(query);
    return jsonSuccess(items);
  } catch (err) {
    if (err.message?.includes('HANA_CONNECTION_STRING')) {
      const wrapped = new Error('Item search is temporarily unavailable');
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
