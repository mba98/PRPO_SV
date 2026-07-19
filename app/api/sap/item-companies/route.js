import { withAuth } from '@/lib/auth';
import { searchSapCompanies } from '@/lib/sapHanaLookups.js';
import { jsonSuccessCached, jsonValidation } from '@/lib/apiHelpers';
import { parseItemCreationLookupQuery } from '@/lib/validators/sapLookup';
import { sapLookupFailureResponse } from '@/lib/sapLookupApi';

export const runtime = 'nodejs';

async function getHandler(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { query, limit } = parseItemCreationLookupQuery(searchParams);
    const items = await searchSapCompanies(query, limit);
    return jsonSuccessCached(items);
  } catch (err) {
    if (err?.name === 'ZodError') return jsonValidation(err);
    return sapLookupFailureResponse(
      'sap/item-companies',
      err,
      'Failed to load item companies',
    );
  }
}

export const GET = withAuth(getHandler, ['items.create']);
