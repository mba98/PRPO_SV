import { withAuth } from '@/lib/auth';
import { retrySapPurchaseRequest } from '@/lib/purchaseRequestsService';
import { jsonSuccess, handleServiceError } from '@/lib/apiHelpers';

async function postHandler(_request, { params }, user) {
  try {
    const result = await retrySapPurchaseRequest(params.id, user);
    if (result.sapResult?.error === 'SAP_FAILED') {
      return jsonSuccess(result, undefined, 502);
    }
    return jsonSuccess(result);
  } catch (err) {
    return handleServiceError(err);
  }
}

export const POST = withAuth(postHandler, ['admin.settings', 'view.all']);
