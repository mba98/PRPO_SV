import { withAuth } from '@/lib/auth';
import { updateUserSchema } from '@/lib/validators/user';
import { getUserById, updateUser, deactivateUser } from '@/lib/usersService';
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
    const parsed = updateUserSchema.safeParse(body);
    if (!parsed.success) {
      return jsonValidation(parsed.error);
    }

    const result = await updateUser(id, parsed.data);
    if (result.error === 'NOT_FOUND') {
      return jsonError('User not found', 'NOT_FOUND', 404);
    }
    if (result.error === 'CONFLICT') {
      return jsonConflict();
    }
    return jsonSuccess(result.user);
  } catch (err) {
    return handleServiceError(err);
  }
}

async function deleteHandler(request, context) {
  try {
    const { id } = context.params;
    const result = await deactivateUser(id);
    if (result.error === 'NOT_FOUND') {
      return jsonError('User not found', 'NOT_FOUND', 404);
    }
    if (result.error === 'CONFLICT') {
      return jsonConflict();
    }
    return jsonSuccess(result.user);
  } catch (err) {
    return handleServiceError(err);
  }
}

export const PUT = withAuth(putHandler, ['admin.users']);
export const DELETE = withAuth(deleteHandler, ['admin.users']);
