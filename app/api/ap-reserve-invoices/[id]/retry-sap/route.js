import { withAuth } from '@/lib/auth';
import { retryApriSapSchema } from '@/lib/validators/apReserveInvoice';
import { retryApriSap } from '@/lib/apReserveInvoicesService';
import {
  jsonSuccess,
  jsonValidation,
  jsonError,
  parseJsonBody,
  handleServiceError,
} from '@/lib/apiHelpers';

async function postHandler(request, { params }, user) {
  const body = await parseJsonBody(request);
  const parsed = retryApriSapSchema.safeParse(body ?? {});
  if (!parsed.success) return jsonValidation(parsed.error);

  try {
    const result = await retryApriSap(params.id, user);
    if (result.sapResult?.error === 'NOT_FOUND') {
      return jsonError('A/P Reserve Invoice not found', 'NOT_FOUND', 404);
    }
    if (result.sapResult?.error === 'DUPLICATE_SAP') {
      return jsonError(result.sapResult.message, 'DUPLICATE_SAP', 409);
    }
    if (result.sapResult?.error === 'INVALID_STATUS') {
      return jsonError(result.sapResult.message, result.sapResult.error, 400);
    }
    if (result.sapResult?.error === 'SAP_FAILED') {
      return jsonSuccess(
        { apri: result.apri, sapResult: { success: false } },
        undefined,
        502,
      );
    }
    return jsonSuccess({ apri: result.apri, sapResult: result.sapResult });
  } catch (err) {
    return handleServiceError(err);
  }
}

export const POST = withAuth(postHandler, ['admin.settings', 'view.all']);
