import { withAuth } from '@/lib/auth';
import { parseListQuery } from '@/lib/errors';
import { createApprovalMatrixSchema } from '@/lib/validators/approvalMatrix';
import { listApprovalMatrix, createApprovalMatrixStep } from '@/lib/approvalMatrixService';
import {
  jsonSuccess,
  jsonValidation,
  parseJsonBody,
  handleServiceError,
} from '@/lib/apiHelpers';

async function getHandler(request) {
  try {
    const { page, limit, sort, order, searchParams } = parseListQuery(request);
    const documentType = searchParams.get('documentType') || undefined;
    const { steps, pagination } = await listApprovalMatrix({
      page,
      limit,
      sort,
      order,
      documentType,
    });
    return jsonSuccess(steps, pagination);
  } catch (err) {
    return handleServiceError(err);
  }
}

async function postHandler(request) {
  try {
    const body = await parseJsonBody(request);
    const parsed = createApprovalMatrixSchema.safeParse(body);
    if (!parsed.success) {
      return jsonValidation(parsed.error);
    }
    const step = await createApprovalMatrixStep(parsed.data);
    return jsonSuccess(step, undefined, 201);
  } catch (err) {
    return handleServiceError(err);
  }
}

export const GET = withAuth(getHandler, ['admin.approval_matrix']);
export const POST = withAuth(postHandler, ['admin.approval_matrix']);
