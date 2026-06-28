import { withAuth } from '@/lib/auth';
import { approveRejectSchema } from '@/lib/validators/purchaseRequest';
import { rejectPurchaseRequest } from '@/lib/purchaseRequestsService';
import {
  jsonSuccess,
  jsonValidation,
  parseJsonBody,
  handleServiceError,
} from '@/lib/apiHelpers';

async function postHandler(request, { params }, user) {
  try {
    const body = (await parseJsonBody(request)) || {};
    const parsed = approveRejectSchema.safeParse(body);
    if (!parsed.success) {
      return jsonValidation(parsed.error);
    }
    const pr = await rejectPurchaseRequest(params.id, user, parsed.data);
    return jsonSuccess(pr);
  } catch (err) {
    return handleServiceError(err);
  }
}

export const POST = withAuth(postHandler, ['pr.approve.whs', 'pr.approve.pm']);
