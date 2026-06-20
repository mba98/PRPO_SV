import { withAuth } from '@/lib/auth';
import { cancelLocalPurchase } from '@/lib/localPurchasesService';
import { cancelLocalPurchaseSchema } from '@/lib/validators/localPurchase';
import { jsonSuccess, jsonValidation, parseJsonBody, handleServiceError } from '@/lib/apiHelpers';

async function postHandler(request, { params }, user) {
  try {
    const body = await parseJsonBody(request);
    const parsed = cancelLocalPurchaseSchema.safeParse(body);
    if (!parsed.success) return jsonValidation(parsed.error);
    const doc = await cancelLocalPurchase(params.id, user, parsed.data);
    return jsonSuccess(doc);
  } catch (err) {
    return handleServiceError(err);
  }
}

export const POST = withAuth(postHandler, ['lp.cancel', 'admin.settings']);
