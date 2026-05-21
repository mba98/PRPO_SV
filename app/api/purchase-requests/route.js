import { withAuth } from '@/lib/auth';
import { parseListQuery } from '@/lib/errors';
import {
  createPurchaseRequestSchema,
} from '@/lib/validators/purchaseRequest';
import { listPurchaseRequests, createPurchaseRequest } from '@/lib/purchaseRequestsService';
import {
  jsonSuccess,
  jsonValidation,
  parseJsonBody,
  handleServiceError,
} from '@/lib/apiHelpers';

const LIST_PERMS = ['pr.create', 'pr.approve.whs', 'pr.approve.pm', 'view.all'];

async function getHandler(request, _ctx, user) {
  try {
    const { page, limit, sort, order, searchParams } = parseListQuery(request);
    const { items, pagination } = await listPurchaseRequests(user, {
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
    const parsed = createPurchaseRequestSchema.safeParse(body);
    if (!parsed.success) {
      return jsonValidation(parsed.error);
    }
    const pr = await createPurchaseRequest(parsed.data, user);
    return jsonSuccess(pr, undefined, 201);
  } catch (err) {
    return handleServiceError(err);
  }
}

export const GET = withAuth(getHandler, LIST_PERMS);
export const POST = withAuth(postHandler, ['pr.create']);
