import { withAuth } from '@/lib/auth';
import { updatePermissionSchema } from '@/lib/validators/permission';
import { updatePermission, deletePermission } from '@/lib/permissionsService';
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
    const body = await parseJsonBody(request);
    const parsed = updatePermissionSchema.safeParse(body);
    if (!parsed.success) return jsonValidation(parsed.error);
    const result = await updatePermission(context.params.id, parsed.data);
    if (result.error === 'NOT_FOUND') return jsonError('Permission not found', 'NOT_FOUND', 404);
    if (result.error === 'CONFLICT') return jsonConflict();
    return jsonSuccess(result.permission);
  } catch (err) {
    return handleServiceError(err);
  }
}

async function deleteHandler(_request, context) {
  try {
    const result = await deletePermission(context.params.id);
    if (result.error === 'NOT_FOUND') return jsonError('Permission not found', 'NOT_FOUND', 404);
    if (result.error === 'PERMISSION_IN_USE') {
      return jsonError(result.message, result.error, 409);
    }
    return jsonSuccess(result);
  } catch (err) {
    return handleServiceError(err);
  }
}

export const PUT = withAuth(putHandler, ['admin.roles']);
export const DELETE = withAuth(deleteHandler, ['admin.roles']);
