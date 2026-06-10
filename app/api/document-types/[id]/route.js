import { withAuth } from '@/lib/auth';
import { updateDocumentTypeSchema } from '@/lib/validators/permission';
import { updateDocumentType, deleteDocumentType } from '@/lib/documentTypesService';
import {
  jsonSuccess,
  jsonError,
  jsonValidation,
  parseJsonBody,
  handleServiceError,
} from '@/lib/apiHelpers';

async function putHandler(request, context) {
  try {
    const body = await parseJsonBody(request);
    const parsed = updateDocumentTypeSchema.safeParse(body);
    if (!parsed.success) return jsonValidation(parsed.error);
    const result = await updateDocumentType(context.params.id, parsed.data);
    if (result.error === 'NOT_FOUND') return jsonError('Document type not found', 'NOT_FOUND', 404);
    return jsonSuccess(result.documentType);
  } catch (err) {
    return handleServiceError(err);
  }
}

async function deleteHandler(_request, context) {
  try {
    const result = await deleteDocumentType(context.params.id);
    if (result.error === 'NOT_FOUND') return jsonError('Document type not found', 'NOT_FOUND', 404);
    return jsonSuccess(result);
  } catch (err) {
    return handleServiceError(err);
  }
}

export const PUT = withAuth(putHandler, ['admin.approval_matrix']);
export const DELETE = withAuth(deleteHandler, ['admin.approval_matrix']);
