import { withAuth } from '@/lib/auth';
import { searchSapItemGroups } from '@/lib/sapHanaLookups.js';
import { jsonSuccessCached } from '@/lib/apiHelpers';
import { parseSapLookupQuery } from '@/lib/validators/sapLookup';
import { sapLookupFailureResponse } from '@/lib/sapLookupApi';

const PERMS = ['pr.create', 'items.create', 'view.all'];

async function getHandler(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { query, limit } = parseSapLookupQuery(searchParams);
    const items = await searchSapItemGroups(query, limit);
    return jsonSuccessCached(items);
  } catch (err) {
    return sapLookupFailureResponse('sap/item-groups', err, 'Failed to load item groups');
  }
}

export const GET = withAuth(getHandler, PERMS);
