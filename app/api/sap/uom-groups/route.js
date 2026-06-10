import { withAuth } from '@/lib/auth';
import { searchSapUomGroups } from '@/lib/sapHanaLookups.js';
import { jsonSuccessCached } from '@/lib/apiHelpers';
import { parseSapLookupQuery } from '@/lib/validators/sapLookup';
import { sapLookupFailureResponse } from '@/lib/sapLookupApi';

const PERMS = ['pr.create', 'items.create', 'view.all'];

async function getHandler(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { query, limit } = parseSapLookupQuery(searchParams);
    const items = await searchSapUomGroups(query, limit);
    return jsonSuccessCached(items);
  } catch (err) {
    const clientMessage = err?.message || 'Failed to load UoM groups';
    return sapLookupFailureResponse('sap/uom-groups', err, clientMessage);
  }
}

export const GET = withAuth(getHandler, PERMS);
