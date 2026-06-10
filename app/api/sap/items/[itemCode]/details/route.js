import { withAuth } from '@/lib/auth';
import { getSapItemDetails } from '@/lib/sapItems.js';
import { jsonSuccess, jsonError } from '@/lib/apiHelpers';
import { sapLookupFailureResponse } from '@/lib/sapLookupApi';

const PERMS = ['pr.create', 'items.create', 'pr.approve.whs', 'po.create', 'view.all'];

async function getHandler(_request, { params }) {
  try {
    const item = await getSapItemDetails(params.itemCode);
    if (!item) {
      return jsonError('Item not found', 'NOT_FOUND', 404);
    }
    return jsonSuccess(item);
  } catch (err) {
    const clientMessage = err?.message || 'Failed to load item details';
    return sapLookupFailureResponse('sap/items/details', err, clientMessage);
  }
}

export const GET = withAuth(getHandler, PERMS);
