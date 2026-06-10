import { withAuth } from '@/lib/auth';
import { searchSapUomGroups } from '@/lib/sapHanaLookups.js';
import { jsonSuccessCached, jsonValidation } from '@/lib/apiHelpers';
import { parseSapLookupQuery } from '@/lib/validators/sapLookup';
import { sapLookupFailureResponse } from '@/lib/sapLookupApi';
import { ZodError } from 'zod';

const PERMS = ['pr.create', 'items.create', 'view.all'];

async function getHandler(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { query, limit } = parseSapLookupQuery(searchParams);
    const items = await searchSapUomGroups(query, limit);
    return jsonSuccessCached(items);
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonValidation(err);
    }
    const clientMessage = err?.message || 'Failed to load UoM groups';
    return sapLookupFailureResponse('sap/uom-groups', err, clientMessage);
  }
}

export const GET = withAuth(getHandler, PERMS);
