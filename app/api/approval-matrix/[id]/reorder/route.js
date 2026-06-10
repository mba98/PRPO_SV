import { withAuth } from '@/lib/auth';
import { reorderApprovalMatrixSchema } from '@/lib/validators/approvalMatrix';
import { reorderApprovalMatrixStep } from '@/lib/approvalMatrixService';
import {
  jsonSuccess,
  jsonError,
  jsonValidation,
  parseJsonBody,
  handleServiceError,
} from '@/lib/apiHelpers';

async function postHandler(request, context, user) {
  try {
    const { id } = context.params;
    const body = await parseJsonBody(request);
    const parsed = reorderApprovalMatrixSchema.safeParse(body);
    if (!parsed.success) return jsonValidation(parsed.error);

    const result = await reorderApprovalMatrixStep(id, parsed.data.direction, user);
    if (result.error === 'NOT_FOUND') {
      return jsonError('Approval step not found', 'NOT_FOUND', 404);
    }
    if (result.error === 'BOUNDARY') {
      return jsonError(result.message, 'BOUNDARY', 400);
    }
    return jsonSuccess(result);
  } catch (err) {
    return handleServiceError(err);
  }
}

export const POST = withAuth(postHandler, ['admin.approval_matrix']);
