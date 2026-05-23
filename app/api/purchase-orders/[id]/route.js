import { withAuth } from '@/lib/auth';
import { updatePurchaseOrderSchema } from '@/lib/validators/purchaseOrder';
import { getPurchaseOrderById, updatePurchaseOrder } from '@/lib/purchaseOrdersService';
import {
  jsonSuccess,
  jsonValidation,
  parseJsonBody,
  handleServiceError,
  jsonError,
} from '@/lib/apiHelpers';

const VIEW_PERMS = ['po.create', 'po.approve.pm', 'po.approve.finance', 'view.all'];

async function getHandler(_request, { params }, user) {
  try {
    const po = await getPurchaseOrderById(params.id, user);
    if (!po) return jsonError('Purchase order not found', 'NOT_FOUND', 404);
    return jsonSuccess(po);
  } catch (err) {
    return handleServiceError(err);
  }
}

async function putHandler(request, { params }, user) {
  try {
    const body = await parseJsonBody(request);
    const parsed = updatePurchaseOrderSchema.safeParse(body);
    if (!parsed.success) return jsonValidation(parsed.error);
    const po = await updatePurchaseOrder(params.id, parsed.data, user);
    return jsonSuccess(po);
  } catch (err) {
    return handleServiceError(err);
  }
}

export const GET = withAuth(getHandler, VIEW_PERMS);
export const PUT = withAuth(putHandler, ['po.create', 'view.all', 'admin.settings']);
