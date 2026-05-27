import { withAuth } from '@/lib/auth';
import { USERS_PICKLIST_PERMISSIONS } from '@/lib/permissions';
import { listUsersPicklist } from '@/lib/usersService';
import { jsonSuccess, handleServiceError } from '@/lib/apiHelpers';

async function getHandler() {
  try {
    const users = await listUsersPicklist();
    return jsonSuccess(users);
  } catch (err) {
    return handleServiceError(err);
  }
}

export const GET = withAuth(getHandler, USERS_PICKLIST_PERMISSIONS);
