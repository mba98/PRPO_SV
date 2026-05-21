import { withAuth } from '@/lib/auth';
import { searchSapCostCenters } from '@/lib/sapLookups.js';
import { jsonSuccessCached } from '@/lib/apiHelpers';
import { parseSapLookupQuery } from '@/lib/validators/sapLookup';
import { sapLookupFailureResponse } from '@/lib/sapLookupApi';

const PERMS = ['pr.create', 'pr.approve.whs', 'pr.approve.pm', 'po.create', 'view.all'];

async function getHandler(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { query, limit } = parseSapLookupQuery(searchParams);
    const items = await searchSapCostCenters(query, limit);
    return jsonSuccessCached(items);
  } catch (err) {
    return sapLookupFailureResponse('sap/cost-centers', err, 'Failed to load cost centers');
  }
}

export const GET = withAuth(getHandler, PERMS);
