import { withAuth } from '@/lib/auth';
import { listAttachments } from '@/lib/attachmentsService.js';
import { jsonSuccess, handleServiceError } from '@/lib/apiHelpers';

async function getHandler(_request, { params }) {
  try {
    const items = await listAttachments(params.documentType, params.documentId);
    return jsonSuccess(items);
  } catch (err) {
    return handleServiceError(err);
  }
}

export const GET = withAuth(getHandler, [
  'pr.create',
  'pr.approve.whs',
  'pr.approve.pm',
  'po.create',
  'apinvoice.create',
  'view.all',
]);
