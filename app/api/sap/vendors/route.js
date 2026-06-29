import { withAuth } from '@/lib/auth';
import { searchSapVendors } from '@/lib/sapLookups.js';
import { jsonSuccess } from '@/lib/apiHelpers';
import { parseSapLookupQuery } from '@/lib/validators/sapLookup';
import { sapLookupFailureResponse } from '@/lib/sapLookupApi';

const PERMS = ['pr.create', 'pr.approve.whs', 'pr.approve.pm', 'po.create', 'view.all'];

async function getHandler(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { query, limit, page } = parseSapLookupQuery(searchParams);
    const { items, pagination } = await searchSapVendors(query, limit, page);
    return jsonSuccess(items, pagination);
  } catch (err) {
    return sapLookupFailureResponse('sap/vendors', err, 'Failed to load vendors');
  }
}

export const GET = withAuth(getHandler, PERMS);
