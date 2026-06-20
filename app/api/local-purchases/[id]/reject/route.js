import { withAuth } from '@/lib/auth';
import { rejectLocalPurchase } from '@/lib/localPurchasesService';
import { rejectLocalPurchaseSchema } from '@/lib/validators/localPurchase';
import { jsonSuccess, jsonValidation, parseJsonBody, handleServiceError } from '@/lib/apiHelpers';
import { LP_APPROVAL_PERMISSIONS } from '@/lib/permissions.js';

async function postHandler(request, { params }, user) {
  try {
    const body = await parseJsonBody(request);
    const parsed = rejectLocalPurchaseSchema.safeParse(body);
    if (!parsed.success) return jsonValidation(parsed.error);
    const result = await rejectLocalPurchase(params.id, user, parsed.data);
    return jsonSuccess(result);
  } catch (err) {
    return handleServiceError(err);
  }
}

export const POST = withAuth(postHandler, LP_APPROVAL_PERMISSIONS);
