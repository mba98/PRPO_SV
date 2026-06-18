import { withAuth } from '@/lib/auth';
import { createApriInSapSchema } from '@/lib/validators/apReserveInvoice';
import { createApriInSap } from '@/lib/apReserveInvoicesService';
import {
  jsonSuccess,
  jsonValidation,
  parseJsonBody,
  handleServiceError,
} from '@/lib/apiHelpers';

async function postHandler(request, { params }, user) {
  try {
    const body = (await parseJsonBody(request)) || {};
    const parsed = createApriInSapSchema.safeParse(body);
    if (!parsed.success) return jsonValidation(parsed.error);

    const result = await createApriInSap(params.id, user, parsed.data);

    if (result.sapResult?.error === 'NOT_FOUND') {
      return handleServiceError(Object.assign(new Error('A/P Reserve Invoice not found'), { code: 'NOT_FOUND' }));
    }
    if (result.sapResult?.error === 'DUPLICATE_SAP') {
      return handleServiceError(
        Object.assign(new Error(result.sapResult.message), { code: 'DUPLICATE_SAP' }),
      );
    }
    if (result.sapResult?.error === 'SAP_FAILED') {
      return jsonSuccess(
        { apri: result.apri, sapResult: { success: false, message: result.sapResult.message } },
        undefined,
        502,
      );
    }

    return jsonSuccess({ apri: result.apri, sapResult: result.sapResult });
  } catch (err) {
    return handleServiceError(err);
  }
}

export const POST = withAuth(postHandler, ['apri.create.sap', 'admin.settings']);
