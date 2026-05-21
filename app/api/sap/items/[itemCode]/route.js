import { withAuth } from '@/lib/auth';
import { getSapItem } from '@/lib/sapItems.js';
import { jsonSuccess, jsonError } from '@/lib/apiHelpers';
import { sapLookupFailureResponse } from '@/lib/sapLookupApi';

const PERMS = ['pr.create', 'pr.approve.whs', 'pr.approve.pm', 'po.create', 'apinvoice.create', 'view.all'];

async function getHandler(_request, { params }) {
  try {
    const item = await getSapItem(params.itemCode);
    if (!item) {
      return jsonError('Item not found', 'NOT_FOUND', 404);
    }
    return jsonSuccess(item);
  } catch (err) {
    return sapLookupFailureResponse('sap/items/detail', err, 'Failed to load SAP item');
  }
}

export const GET = withAuth(getHandler, PERMS);
