import { withAuth } from '@/lib/auth';
import { ROLES_PICKLIST_PERMISSIONS } from '@/lib/permissions';
import { listRolesPicklist } from '@/lib/rolesService';
import { jsonSuccess, handleServiceError } from '@/lib/apiHelpers';

async function getHandler() {
  try {
    const roles = await listRolesPicklist();
    return jsonSuccess(roles);
  } catch (err) {
    return handleServiceError(err);
  }
}

export const GET = withAuth(getHandler, ROLES_PICKLIST_PERMISSIONS);
