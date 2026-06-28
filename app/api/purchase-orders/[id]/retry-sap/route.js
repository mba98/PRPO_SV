import { withAuth } from '@/lib/auth';
import { retrySapForOrder, sanitizePo } from '@/lib/purchaseOrdersService';
import PurchaseOrder from '@/models/PurchaseOrder.js';
import { jsonSuccess, handleServiceError, jsonError } from '@/lib/apiHelpers';

async function postHandler(_request, { params }, user) {
  try {
    const result = await retrySapForOrder(params.id, user);
    if (result.error === 'NOT_FOUND') return jsonError('Purchase order not found', 'NOT_FOUND', 404);
    if (result.error === 'DUPLICATE_SAP') return jsonError(result.message, 'DUPLICATE_SAP', 409);
    if (result.error === 'INVALID_STATUS') return jsonError(result.message, result.error, 400);
    if (result.error === 'SAP_FAILED') {
      return jsonSuccess(
        { po: sanitizePo(await PurchaseOrder.findById(params.id).lean()), sapResult: result },
        undefined,
        502,
      );
    }
    const refreshed = await PurchaseOrder.findById(params.id).lean();
    return jsonSuccess({ po: sanitizePo(refreshed), sapResult: result });
  } catch (err) {
    return handleServiceError(err);
  }
}

export const POST = withAuth(postHandler, [
  'po.create',
  'po.approve.pm',
  'po.approve.om',
  'po.approve.finance',
  'admin.settings',
  'view.all',
]);
