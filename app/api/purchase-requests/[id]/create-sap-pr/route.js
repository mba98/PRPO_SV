import { withAuth } from '@/lib/auth';
import PurchaseRequest from '@/models/PurchaseRequest.js';
import { connectDB } from '@/lib/mongodb';
import { createSapPurchaseRequest } from '@/lib/sap/prSap.js';
import { sanitizePr } from '@/lib/purchaseRequestsService';
import { jsonSuccess, handleServiceError, jsonError } from '@/lib/apiHelpers';

async function postHandler(_request, { params }, user) {
  try {
    await connectDB();
    const pr = await PurchaseRequest.findById(params.id).lean();
    if (!pr) {
      return jsonError('Purchase request not found', 'NOT_FOUND', 404);
    }
    const result = await createSapPurchaseRequest(params.id, user);
    if (result.error === 'NOT_FOUND') {
      return jsonError('Purchase request not found', 'NOT_FOUND', 404);
    }
    if (result.error === 'DUPLICATE_SAP') {
      return jsonError(result.message, 'DUPLICATE_SAP', 409);
    }
    if (result.error === 'SAP_VALIDATION') {
      return jsonError(result.message, 'SAP_VALIDATION', 400);
    }
    if (result.error === 'SAP_FAILED') {
      return jsonError(result.message || 'Failed to create purchase request in SAP', 'SAP_FAILED', 502);
    }
    const refreshed = await PurchaseRequest.findById(params.id).lean();
    return jsonSuccess({ pr: sanitizePr(refreshed), sapResult: result });
  } catch (err) {
    return handleServiceError(err);
  }
}

export const POST = withAuth(postHandler, ['admin.settings', 'sap.pr.create']);
