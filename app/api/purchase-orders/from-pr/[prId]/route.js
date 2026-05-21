import { withAuth } from '@/lib/auth';
import { createPoFromPrSchema } from '@/lib/validators/purchaseOrder';
import { createPurchaseOrderFromPr } from '@/lib/purchaseOrdersService';
import {
  jsonSuccess,
  jsonValidation,
  parseJsonBody,
  handleServiceError,
  jsonError,
} from '@/lib/apiHelpers';

async function postHandler(request, { params }, user) {
  try {
    const body = (await parseJsonBody(request)) || {};
    const parsed = createPoFromPrSchema.safeParse(body);
    if (!parsed.success) {
      return jsonValidation(parsed.error);
    }
    const result = await createPurchaseOrderFromPr(params.prId, user, parsed.data);
    if (result.error === 'NOT_FOUND') {
      return jsonError('Purchase request not found', 'NOT_FOUND', 404);
    }
    if (result.error === 'DUPLICATE_PO') {
      return jsonError(result.message, 'DUPLICATE_PO', 409);
    }
    if (
      result.error === 'INVALID_STATUS' ||
      result.error === 'NO_SAP_PR' ||
      result.error === 'VENDOR_REQUIRED' ||
      result.error === 'NO_LINES'
    ) {
      return jsonError(result.message, result.error, 400);
    }
    if (result.error === 'SAP_FAILED') {
      return jsonError('Failed to create purchase order in SAP', 'SAP_FAILED', 502);
    }
    return jsonSuccess(result, undefined, 201);
  } catch (err) {
    return handleServiceError(err);
  }
}

export const POST = withAuth(postHandler, ['po.create', 'view.all']);
