import { withAuth } from '@/lib/auth';
import { updateRoleSchema } from '@/lib/validators/role';
import { updateRole, deleteRole } from '@/lib/rolesService';
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
    const parsed = updateRoleSchema.safeParse(body);
    if (!parsed.success) {
      return jsonValidation(parsed.error);
    }

    const result = await updateRole(id, parsed.data);
    if (result.error === 'NOT_FOUND') {
      return jsonError('Role not found', 'NOT_FOUND', 404);
    }
    if (result.error === 'CONFLICT') {
      return jsonConflict();
    }
    return jsonSuccess(result.role);
  } catch (err) {
    return handleServiceError(err);
  }
}

async function deleteHandler(request, context) {
  try {
    const { id } = context.params;
    const result = await deleteRole(id);
    if (result.error === 'NOT_FOUND') {
      return jsonError('Role not found', 'NOT_FOUND', 404);
    }
    if (result.error === 'ROLE_IN_USE') {
      return jsonError(result.message, result.error, 409);
    }
    return jsonSuccess({ deleted: true, id: result.id });
  } catch (err) {
    return handleServiceError(err);
  }
}

export const PUT = withAuth(putHandler, ['admin.roles']);
export const DELETE = withAuth(deleteHandler, ['admin.roles']);
