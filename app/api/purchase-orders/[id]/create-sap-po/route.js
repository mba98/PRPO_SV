import { withAuth } from '@/lib/auth';
import { createSapPoForOrder } from '@/lib/purchaseOrdersService';
import { sanitizePo } from '@/lib/purchaseOrdersService';
import PurchaseOrder from '@/models/PurchaseOrder.js';
import { jsonSuccess, handleServiceError, jsonError } from '@/lib/apiHelpers';

async function postHandler(_request, { params }, user) {
  try {
    const result = await createSapPoForOrder(params.id, user);
    if (result.error === 'NOT_FOUND') return jsonError('Purchase order not found', 'NOT_FOUND', 404);
    if (result.error === 'DUPLICATE_SAP') return jsonError(result.message, 'DUPLICATE_SAP', 409);
    if (result.error === 'INVALID_STATUS' || result.error === 'NO_SAP_PR') {
      return jsonError(result.message, result.error, 400);
    }
    if (result.error === 'SAP_FAILED') {
      return jsonError('Failed to create purchase order in SAP', 'SAP_FAILED', 502);
    }
    const refreshed = await PurchaseOrder.findById(params.id).lean();
    return jsonSuccess({ po: sanitizePo(refreshed), sapResult: result });
  } catch (err) {
    return handleServiceError(err);
  }
}

export const POST = withAuth(postHandler, ['admin.settings', 'sap.po.create']);
