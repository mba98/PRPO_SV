import { withAuth } from '@/lib/auth';
import { submitLocalPurchase } from '@/lib/localPurchasesService';
import { submitLocalPurchaseSchema } from '@/lib/validators/localPurchase';
import { wrapLocalPurchaseResponse } from '@/lib/localPurchaseDocument.js';
import { jsonSuccess, jsonValidation, parseJsonBody, handleServiceError } from '@/lib/apiHelpers';

async function postHandler(request, { params }, user) {
  try {
    const body = await parseJsonBody(request);
    const parsed = submitLocalPurchaseSchema.safeParse(body);
    if (!parsed.success) return jsonValidation(parsed.error);
    const doc = await submitLocalPurchase(params.id, user, parsed.data);
    return jsonSuccess({
      ...wrapLocalPurchaseResponse(doc.document),
      notification: doc.notification,
    });
  } catch (err) {
    return handleServiceError(err);
  }
}

export const POST = withAuth(postHandler, ['lp.create']);
