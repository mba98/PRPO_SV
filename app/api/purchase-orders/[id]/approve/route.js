import { withAuth } from '@/lib/auth';
import { approveRejectPoSchema } from '@/lib/validators/purchaseOrder';
import { approvePurchaseOrder } from '@/lib/purchaseOrdersService';
import {
  jsonSuccess,
  jsonValidation,
  parseJsonBody,
  handleServiceError,
} from '@/lib/apiHelpers';

async function postHandler(request, { params }, user) {
  try {
    const body = (await parseJsonBody(request)) || {};
    const parsed = approveRejectPoSchema.safeParse(body);
    if (!parsed.success) return jsonValidation(parsed.error);
    const result = await approvePurchaseOrder(params.id, user, parsed.data);
    return jsonSuccess(result);
  } catch (err) {
    return handleServiceError(err);
  }
}

export const POST = withAuth(postHandler, ['po.approve.pm', 'po.approve.finance', 'view.all']);
