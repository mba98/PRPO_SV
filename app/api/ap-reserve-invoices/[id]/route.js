import { withAuth } from '@/lib/auth';
import { getApReserveInvoiceById } from '@/lib/apReserveInvoicesService';
import { jsonSuccess, handleServiceError, jsonError } from '@/lib/apiHelpers';

async function getHandler(_request, { params }, user) {
  try {
    const apri = await getApReserveInvoiceById(params.id, user);
    if (!apri) return jsonError('A/P Reserve Invoice not found', 'NOT_FOUND', 404);
    return jsonSuccess(apri);
  } catch (err) {
    return handleServiceError(err);
  }
}

export const GET = withAuth(getHandler, ['apinvoice.create', 'view.all']);
