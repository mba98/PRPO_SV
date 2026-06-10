import { withAuth } from '@/lib/auth';
import { searchSapWarehousesHana } from '@/lib/sapHanaLookups.js';
import { jsonSuccessCached, jsonValidation } from '@/lib/apiHelpers';
import { parseSapLookupQuery } from '@/lib/validators/sapLookup';
import { sapLookupFailureResponse } from '@/lib/sapLookupApi';
import { ZodError } from 'zod';

const PERMS = ['pr.create', 'pr.approve.whs', 'pr.approve.pm', 'po.create', 'view.all'];

async function getHandler(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { query, limit } = parseSapLookupQuery(searchParams);
    const items = await searchSapWarehousesHana(query, limit);
    return jsonSuccessCached(items);
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonValidation(err);
    }
    const clientMessage = err?.message || 'Failed to load warehouses';
    return sapLookupFailureResponse('sap/warehouses', err, clientMessage);
  }
}

export const GET = withAuth(getHandler, PERMS);
