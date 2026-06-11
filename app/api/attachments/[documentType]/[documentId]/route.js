import { withAuth } from '@/lib/auth';
import { listAttachments } from '@/lib/attachmentsService.js';
import { jsonSuccess, handleServiceError } from '@/lib/apiHelpers';

import { PORTAL_DASHBOARD_PERMISSIONS } from '@/lib/permissions.js';

const REQUIRED_PERMS = PORTAL_DASHBOARD_PERMISSIONS;

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
