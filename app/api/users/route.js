import { withAuth } from '@/lib/auth';
import { parseListQuery } from '@/lib/errors';
import { createUserSchema } from '@/lib/validators/user';
import { listUsers, createUser } from '@/lib/usersService';
import {
  jsonSuccess,
  jsonValidation,
  parseJsonBody,
  handleServiceError,
} from '@/lib/apiHelpers';

async function getHandler(request) {
  try {
    const { page, limit, sort, order, q, status } = parseListQuery(request);
    const { users, pagination } = await listUsers({ page, limit, sort, order, q, status });
    return jsonSuccess(users, pagination);
  } catch (err) {
    return handleServiceError(err);
  }
}

async function postHandler(request) {
  try {
    const body = await parseJsonBody(request);
    const parsed = createUserSchema.safeParse(body);
    if (!parsed.success) {
      return jsonValidation(parsed.error);
    }
    const user = await createUser(parsed.data);
    return jsonSuccess(user, undefined, 201);
  } catch (err) {
    return handleServiceError(err);
  }
}

export const GET = withAuth(getHandler, ['admin.users']);
export const POST = withAuth(postHandler, ['admin.users']);
