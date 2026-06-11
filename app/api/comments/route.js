import { withAuth } from '@/lib/auth';
import { addComment } from '@/lib/commentsService';
import { createCommentSchema } from '@/lib/validators/comment';
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
    const parsed = createCommentSchema.safeParse(body);
    if (!parsed.success) {
      return jsonValidation(parsed.error);
    }
    const row = await addComment(user, parsed.data);
    return jsonSuccess(row, undefined, 201);
  } catch (err) {
    return handleServiceError(err);
  }
}

export const POST = withAuth(postHandler, REQUIRED_PERMS);
