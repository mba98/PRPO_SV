import { withAuth } from '@/lib/auth';
import { parseListQuery } from '@/lib/errors';
import { createRoleSchema } from '@/lib/validators/role';
import { listRoles, createRole } from '@/lib/rolesService';
import {
  jsonSuccess,
  jsonValidation,
  parseJsonBody,
  handleServiceError,
} from '@/lib/apiHelpers';

async function getHandler(request) {
  try {
    const { page, limit, sort, order, q } = parseListQuery(request);
    const { roles, pagination } = await listRoles({ page, limit, sort, order, q });
    return jsonSuccess(roles, pagination);
  } catch (err) {
    return handleServiceError(err);
  }
}

async function postHandler(request) {
  try {
    const body = await parseJsonBody(request);
    const parsed = createRoleSchema.safeParse(body);
    if (!parsed.success) {
      return jsonValidation(parsed.error);
    }
    const role = await createRole(parsed.data);
    return jsonSuccess(role, undefined, 201);
  } catch (err) {
    return handleServiceError(err);
  }
}

export const GET = withAuth(getHandler, ['admin.roles']);
export const POST = withAuth(postHandler, ['admin.roles']);
