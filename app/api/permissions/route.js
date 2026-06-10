import { withAuth } from '@/lib/auth';
import { createPermissionSchema } from '@/lib/validators/permission';
import {
  listPermissions,
  listPermissionGroups,
  createPermission,
} from '@/lib/permissionsService';
import {
  jsonSuccess,
  jsonValidation,
  parseJsonBody,
  handleServiceError,
} from '@/lib/apiHelpers';

async function getHandler(request) {
  try {
    const { searchParams } = new URL(request.url);
    const grouped = searchParams.get('grouped') === 'true';
    if (grouped) {
      return jsonSuccess(await listPermissionGroups());
    }
    return jsonSuccess(await listPermissions());
  } catch (err) {
    return handleServiceError(err);
  }
}

async function postHandler(request) {
  try {
    const body = await parseJsonBody(request);
    const parsed = createPermissionSchema.safeParse(body);
    if (!parsed.success) return jsonValidation(parsed.error);
    const perm = await createPermission(parsed.data);
    return jsonSuccess(perm, undefined, 201);
  } catch (err) {
    return handleServiceError(err);
  }
}

export const GET = withAuth(getHandler, ['admin.roles', 'admin.approval_matrix', 'admin.users']);
export const POST = withAuth(postHandler, ['admin.roles']);
