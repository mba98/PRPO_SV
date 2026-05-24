import { withAuth } from '@/lib/auth';
import { completeUpload } from '@/lib/attachmentsService.js';
import { completeUploadSchema } from '@/lib/validators/attachment.js';
import {
  jsonSuccess,
  jsonValidation,
  parseJsonBody,
  handleServiceError,
} from '@/lib/apiHelpers';

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

async function postHandler(request, _ctx, user) {
  try {
    const body = await parseJsonBody(request);
    const parsed = completeUploadSchema.safeParse(body);
    if (!parsed.success) {
      return jsonValidation(parsed.error);
    }
    const row = await completeUpload(user, parsed.data);
    return jsonSuccess(row, undefined, 201);
  } catch (err) {
    return handleServiceError(err);
  }
}

export const POST = withAuth(postHandler, REQUIRED_PERMS);
