import { withAuth } from '@/lib/auth';
import { createSapItemSchema } from '@/lib/validators/purchaseRequest';
import { createSapItem } from '@/lib/sapItems.js';
import {
  jsonSuccess,
  jsonValidation,
  parseJsonBody,
  handleServiceError,
} from '@/lib/apiHelpers';

async function postHandler(request, _ctx, user) {
  try {
    const body = await parseJsonBody(request);
    const parsed = createSapItemSchema.safeParse(body);
    if (!parsed.success) {
      return jsonValidation(parsed.error);
    }
    const result = await createSapItem(parsed.data, user, parsed.data.relatedPRNumber);
    return jsonSuccess(result.data, undefined, 201);
  } catch (err) {
    if (err.code === 'DUPLICATE_ITEM') {
      return handleServiceError(err);
    }
    if (err.code === 'SAP_ITEM_FAILED') {
      return handleServiceError(err);
    }
    return handleServiceError(err);
  }
}

export const POST = withAuth(postHandler, ['items.create']);
