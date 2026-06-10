import { withAuth } from '@/lib/auth';
import { updateApprovalMatrixSchema } from '@/lib/validators/approvalMatrix';
import {
  updateApprovalMatrixStep,
  deleteApprovalMatrixStep,
} from '@/lib/approvalMatrixService';
import {
  jsonSuccess,
  jsonError,
  jsonValidation,
  jsonConflict,
  parseJsonBody,
  handleServiceError,
} from '@/lib/apiHelpers';

async function putHandler(request, context, user) {
  try {
    const { id } = context.params;
    const body = await parseJsonBody(request);
    const parsed = updateApprovalMatrixSchema.safeParse(body);
    if (!parsed.success) {
      return jsonValidation(parsed.error);
    }

    const result = await updateApprovalMatrixStep(id, parsed.data, user);
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

async function deleteHandler(_request, context, user) {
  try {
    const { id } = context.params;
    const result = await deleteApprovalMatrixStep(id, user);
    if (result.error === 'NOT_FOUND') {
      return jsonError('Approval step not found', 'NOT_FOUND', 404);
    }
    return jsonSuccess(result);
  } catch (err) {
    return handleServiceError(err);
  }
}

export const PUT = withAuth(putHandler, ['admin.approval_matrix']);
export const DELETE = withAuth(deleteHandler, ['admin.approval_matrix']);
