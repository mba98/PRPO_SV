import { withAuth } from '@/lib/auth';
import { createApriFromPoSchema } from '@/lib/validators/apReserveInvoice';
import { createApriFromPo } from '@/lib/apReserveInvoicesService';
import {
  jsonSuccess,
  jsonValidation,
  handleServiceError,
  jsonError,
  parseJsonBody,
} from '@/lib/apiHelpers';

async function postHandler(request, { params }, user) {
  const body = await parseJsonBody(request);
  const parsed = createApriFromPoSchema.safeParse(body ?? {});
  if (!parsed.success) return jsonValidation(parsed.error);

  try {
    const result = await createApriFromPo(params.poId, user);
    if (result.error === 'NOT_FOUND') {
      return jsonError('Purchase order not found', 'NOT_FOUND', 404);
    }
    if (result.error === 'INVALID_STATUS' || result.error === 'NO_SAP_PO' || result.error === 'INVALID_LINES') {
      return jsonError(result.message, result.error, 400);
    }
    if (result.error === 'DUPLICATE_APRI' || result.error === 'APRI_EXISTS_FAILED') {
      return jsonError(result.message, result.error, 409);
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

export const POST = withAuth(postHandler, ['apinvoice.create']);
