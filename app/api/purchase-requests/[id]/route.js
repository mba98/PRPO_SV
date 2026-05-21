import { withAuth } from '@/lib/auth';
import {
  createPurchaseRequestSchema,
  updatePurchaseRequestSchema,
} from '@/lib/validators/purchaseRequest';
import {
  getPurchaseRequestById,
  updatePurchaseRequest,
} from '@/lib/purchaseRequestsService';
import {
  jsonSuccess,
  jsonValidation,
  parseJsonBody,
  handleServiceError,
  jsonError,
} from '@/lib/apiHelpers';

const VIEW_PERMS = ['pr.create', 'pr.approve.whs', 'pr.approve.pm', 'view.all'];

async function getHandler(_request, { params }, user) {
  try {
    const pr = await getPurchaseRequestById(params.id, user);
    if (!pr) {
      return jsonError('Purchase request not found', 'NOT_FOUND', 404);
    }
    return jsonSuccess(pr);
  } catch (err) {
    return handleServiceError(err);
  }
}

async function putHandler(request, { params }, user) {
  try {
    const body = await parseJsonBody(request);
    const parsed = updatePurchaseRequestSchema.safeParse(body);
    if (!parsed.success) {
      return jsonValidation(parsed.error);
    }
    if (parsed.data.lines && parsed.data.lines.length === 0) {
      return jsonError('At least one line item is required', 'VALIDATION', 400);
    }
    const pr = await updatePurchaseRequest(params.id, parsed.data, user);
    return jsonSuccess(pr);
  } catch (err) {
    return handleServiceError(err);
  }
}

export const GET = withAuth(getHandler, VIEW_PERMS);
export const PUT = withAuth(putHandler, ['pr.create', 'view.all']);
