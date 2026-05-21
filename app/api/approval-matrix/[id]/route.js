import { withAuth } from '@/lib/auth';
import { updateApprovalMatrixSchema } from '@/lib/validators/approvalMatrix';
import { updateApprovalMatrixStep } from '@/lib/approvalMatrixService';
import {
  jsonSuccess,
  jsonError,
  jsonValidation,
  jsonConflict,
  parseJsonBody,
  handleServiceError,
} from '@/lib/apiHelpers';

async function putHandler(request, context) {
  try {
    const { id } = context.params;
    const body = await parseJsonBody(request);
    const parsed = updateApprovalMatrixSchema.safeParse(body);
    if (!parsed.success) {
      return jsonValidation(parsed.error);
    }

    const result = await updateApprovalMatrixStep(id, parsed.data);
    if (result.error === 'NOT_FOUND') {
      return jsonError('Approval step not found', 'NOT_FOUND', 404);
    }
    if (result.error === 'CONFLICT') {
      return jsonConflict();
    }
    return jsonSuccess(result.step);
  } catch (err) {
    return handleServiceError(err);
  }
}

export const PUT = withAuth(putHandler, ['admin.approval_matrix']);
