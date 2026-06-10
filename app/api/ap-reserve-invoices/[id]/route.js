import { withAuth } from '@/lib/auth';
import { getApReserveInvoiceById, updateApriQuantities } from '@/lib/apReserveInvoicesService';
import { updateApriSchema } from '@/lib/validators/apReserveInvoice';
import {
  jsonSuccess,
  handleServiceError,
  jsonError,
  jsonValidation,
  parseJsonBody,
} from '@/lib/apiHelpers';

async function getHandler(_request, { params }, user) {
  try {
    const apri = await getApReserveInvoiceById(params.id, user);
    if (!apri) return jsonError('A/P Reserve Invoice not found', 'NOT_FOUND', 404);
    return jsonSuccess(apri);
  } catch (err) {
    return handleServiceError(err);
  }
}

async function putHandler(request, { params }, user) {
  try {
    const body = (await parseJsonBody(request)) || {};
    const parsed = updateApriSchema.safeParse(body);
    if (!parsed.success) return jsonValidation(parsed.error);
    const apri = await updateApriQuantities(params.id, parsed.data, user);
    return jsonSuccess(apri);
  } catch (err) {
    return handleServiceError(err);
  }
}

export const GET = withAuth(getHandler, ['apinvoice.create', 'view.all', 'pr.approve.whs']);
export const PUT = withAuth(putHandler, ['apinvoice.create', 'view.all']);
