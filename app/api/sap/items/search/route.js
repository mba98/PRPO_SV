import { withAuth } from '@/lib/auth';
import { searchSapItems } from '@/lib/sapItems.js';
import { jsonSuccess } from '@/lib/apiHelpers';
import { parseSapLookupQuery } from '@/lib/validators/sapLookup';
import { sapLookupFailureResponse } from '@/lib/sapLookupApi';

const PERMS = ['pr.create', 'pr.approve.whs', 'pr.approve.pm', 'po.create', 'apinvoice.create', 'view.all'];

async function getHandler(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { query, limit } = parseSapLookupQuery(searchParams);
    if (!query.trim()) {
      return jsonSuccess([]);
    }
    const items = await searchSapItems(query, limit);
    return jsonSuccess(items);
  } catch (err) {
    return sapLookupFailureResponse('sap/items/search', err, 'Failed to search SAP items');
  }
}

export const GET = withAuth(getHandler, PERMS);
