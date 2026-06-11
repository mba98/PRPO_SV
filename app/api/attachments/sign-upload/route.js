import { withAuth } from '@/lib/auth';
import { signUpload } from '@/lib/attachmentsService.js';
import { signUploadSchema } from '@/lib/validators/attachment.js';
import {
  jsonSuccess,
  jsonValidation,
  parseJsonBody,
  handleServiceError,
} from '@/lib/apiHelpers';

import { PORTAL_DASHBOARD_PERMISSIONS } from '@/lib/permissions.js';

const REQUIRED_PERMS = PORTAL_DASHBOARD_PERMISSIONS;

async function postHandler(request, _ctx, user) {
  try {
    const body = await parseJsonBody(request);
    const parsed = signUploadSchema.safeParse(body);
    if (!parsed.success) {
      return jsonValidation(parsed.error);
    }
    const data = await signUpload(user, parsed.data);
    return jsonSuccess(data);
  } catch (err) {
    return handleServiceError(err);
  }
}

export const POST = withAuth(postHandler, REQUIRED_PERMS);
