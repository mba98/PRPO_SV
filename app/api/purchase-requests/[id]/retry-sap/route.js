import { withAuth } from '@/lib/auth';
import { retrySapPurchaseRequest } from '@/lib/purchaseRequestsService';
import { jsonSuccess, jsonError, handleServiceError } from '@/lib/apiHelpers';

async function postHandler(_request, { params }, user) {
  try {
    const result = await retrySapPurchaseRequest(params.id, user);
    if (result.sapResult?.error === 'SAP_VALIDATION') {
      return jsonError(result.sapResult.message, 'SAP_VALIDATION', 400);
    }
    if (result.sapResult?.error === 'SAP_FAILED') {
      return jsonSuccess(
        { ...result, message: result.sapResult.message },
        undefined,
        502,
      );
    }
    return jsonSuccess(result);
  } catch (err) {
    return handleServiceError(err);
  }
}

export const POST = withAuth(postHandler, ['pr.approve.pm', 'admin.settings', 'view.all']);
