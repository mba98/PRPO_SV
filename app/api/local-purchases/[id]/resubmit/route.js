import { withAuth } from '@/lib/auth';
import { resubmitLocalPurchase } from '@/lib/localPurchasesService';
import { submitLocalPurchaseSchema } from '@/lib/validators/localPurchase';
import { jsonSuccess, jsonValidation, parseJsonBody, handleServiceError } from '@/lib/apiHelpers';

async function postHandler(request, { params }, user) {
  try {
    const body = await parseJsonBody(request);
    const parsed = submitLocalPurchaseSchema.safeParse(body);
    if (!parsed.success) return jsonValidation(parsed.error);
    const doc = await resubmitLocalPurchase(params.id, user, parsed.data);
    return jsonSuccess(doc);
  } catch (err) {
    return handleServiceError(err);
  }
}

export const POST = withAuth(postHandler, ['lp.create']);
