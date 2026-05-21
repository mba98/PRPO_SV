import { withAuth } from '@/lib/auth';
import { listDepartments } from '@/lib/lookups/departments.js';
import { jsonSuccessCached, handleServiceError } from '@/lib/apiHelpers';

const PERMS = ['pr.create', 'pr.approve.whs', 'pr.approve.pm', 'po.create', 'view.all'];

async function getHandler() {
  try {
    const items = await listDepartments();
    return jsonSuccessCached(items);
  } catch (err) {
    return handleServiceError(err);
  }
}

export const GET = withAuth(getHandler, PERMS);
