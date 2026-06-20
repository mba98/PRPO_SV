import { withAuth } from '@/lib/auth';
import { parseListQuery } from '@/lib/errors';
import { createLocalPurchaseSchema } from '@/lib/validators/localPurchase';
import { listLocalPurchases, createLocalPurchase } from '@/lib/localPurchasesService';
import {
  jsonSuccess,
  jsonValidation,
  parseJsonBody,
  handleServiceError,
} from '@/lib/apiHelpers';
import { LP_LIST_PERMISSIONS } from '@/lib/permissions.js';

async function getHandler(request, _ctx, user) {
  try {
    const { page, limit, sort, order, searchParams } = parseListQuery(request);
    const { items, pagination } = await listLocalPurchases(user, {
      page,
      limit,
      sort,
      order,
      searchParams,
    });
    return jsonSuccess(items, pagination);
  } catch (err) {
    return handleServiceError(err);
  }
}

async function postHandler(request, _ctx, user) {
  try {
    const body = await parseJsonBody(request);
    const parsed = createLocalPurchaseSchema.safeParse(body);
    if (!parsed.success) return jsonValidation(parsed.error);
    const doc = await createLocalPurchase(parsed.data, user);
    return jsonSuccess(doc, undefined, 201);
  } catch (err) {
    return handleServiceError(err);
  }
}

export const GET = withAuth(getHandler, LP_LIST_PERMISSIONS);
export const POST = withAuth(postHandler, ['lp.create']);
