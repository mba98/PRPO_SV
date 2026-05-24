import { withAuth } from '@/lib/auth';
import { listAttachments } from '@/lib/attachmentsService.js';
import { jsonSuccess, handleServiceError } from '@/lib/apiHelpers';

const REQUIRED_PERMS = [
  'pr.create',
  'pr.approve.whs',
  'pr.approve.pm',
  'po.create',
  'po.approve.pm',
  'po.approve.finance',
  'apinvoice.create',
  'view.all',
];

async function getHandler(_request, { params }, user) {
  try {
    const { documentType, documentId } = params;
    const items = await listAttachments(documentType, documentId, user);
    return jsonSuccess(items);
  } catch (err) {
    return handleServiceError(err);
  }
}

export const GET = withAuth(getHandler, REQUIRED_PERMS);
