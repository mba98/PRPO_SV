import { withAuth } from '@/lib/auth';
import { approveRejectApriSchema } from '@/lib/validators/apReserveInvoice';
import { rejectApri } from '@/lib/apReserveInvoicesService';
import {
  jsonSuccess,
  jsonValidation,
  parseJsonBody,
  handleServiceError,
} from '@/lib/apiHelpers';
import { APRI_VIEW_PERMISSIONS } from '@/lib/permissions.js';

async function postHandler(request, { params }, user) {
  try {
    const body = (await parseJsonBody(request)) || {};
    const parsed = approveRejectApriSchema.safeParse(body);
    if (!parsed.success) return jsonValidation(parsed.error);
    const apri = await rejectApri(params.id, user, parsed.data);
    return jsonSuccess(apri);
  } catch (err) {
    return handleServiceError(err);
  }
}

export const POST = withAuth(postHandler, APRI_VIEW_PERMISSIONS);
