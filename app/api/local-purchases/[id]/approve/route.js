import { withAuth } from '@/lib/auth';
import { approveLocalPurchase } from '@/lib/localPurchasesService';
import { approveRejectLocalPurchaseSchema } from '@/lib/validators/localPurchase';
import { jsonSuccess, jsonValidation, parseJsonBody, handleServiceError } from '@/lib/apiHelpers';
import { LP_APPROVAL_PERMISSIONS } from '@/lib/permissions.js';

async function postHandler(request, { params }, user) {
  try {
    const body = await parseJsonBody(request);
    const parsed = approveRejectLocalPurchaseSchema.safeParse(body);
    if (!parsed.success) return jsonValidation(parsed.error);
    const result = await approveLocalPurchase(params.id, user, parsed.data);
    return jsonSuccess(result);
  } catch (err) {
    return handleServiceError(err);
  }
}

export const POST = withAuth(postHandler, LP_APPROVAL_PERMISSIONS);
