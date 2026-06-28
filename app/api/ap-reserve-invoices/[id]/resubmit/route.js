import { withAuth } from '@/lib/auth';
import { approveRejectApriSchema } from '@/lib/validators/apReserveInvoice';
import { resubmitApri } from '@/lib/apReserveInvoicesService';
import {
  jsonSuccess,
  jsonValidation,
  parseJsonBody,
  handleServiceError,
} from '@/lib/apiHelpers';

async function postHandler(request, { params }, user) {
  try {
    const body = (await parseJsonBody(request)) || {};
    const parsed = approveRejectApriSchema.safeParse(body);
    if (!parsed.success) return jsonValidation(parsed.error);
    const apri = await resubmitApri(params.id, user, parsed.data);
    return jsonSuccess(apri);
  } catch (err) {
    return handleServiceError(err);
  }
}

export const POST = withAuth(postHandler, ['apinvoice.create', 'apri.create', 'apri.resubmit']);
