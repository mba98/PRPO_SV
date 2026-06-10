import { withAuth } from '@/lib/auth';
import { listApprovalMatrixAudit } from '@/lib/approvalMatrixAudit';
import { jsonSuccess, handleServiceError } from '@/lib/apiHelpers';

async function getHandler(request) {
  try {
    const { searchParams } = new URL(request.url);
    const documentType = searchParams.get('documentType') || undefined;
    const limit = Number(searchParams.get('limit') || 50);
    const rows = await listApprovalMatrixAudit({ documentType, limit });
    return jsonSuccess(rows);
  } catch (err) {
    return handleServiceError(err);
  }
}

export const GET = withAuth(getHandler, ['admin.approval_matrix']);
