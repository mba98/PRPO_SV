import { withAuth } from '@/lib/auth';
import { listApprovalHistory } from '@/lib/approvalHistoryService';
import { documentScopeSchema } from '@/lib/validators/comment';
import {
  jsonSuccess,
  jsonValidation,
  handleServiceError,
} from '@/lib/apiHelpers';

import { PORTAL_DASHBOARD_PERMISSIONS } from '@/lib/permissions.js';

const REQUIRED_PERMS = PORTAL_DASHBOARD_PERMISSIONS;

async function getHandler(_request, { params }, user) {
  try {
    const parsed = documentScopeSchema.safeParse(params);
    if (!parsed.success) {
      return jsonValidation(parsed.error);
    }
    const items = await listApprovalHistory(
      user,
      parsed.data.documentType,
      parsed.data.documentId,
    );
    return jsonSuccess(items);
  } catch (err) {
    return handleServiceError(err);
  }
}

export const GET = withAuth(getHandler, REQUIRED_PERMS);
