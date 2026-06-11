import { withAuth } from '@/lib/auth';
import { getNavigationCounts } from '@/lib/navigationCountsService.js';
import { jsonSuccessCached, handleServiceError } from '@/lib/apiHelpers';
import { PORTAL_DASHBOARD_PERMISSIONS } from '@/lib/permissions.js';

async function getHandler(_request, _ctx, user) {
  try {
    const counts = await getNavigationCounts(user);
    return jsonSuccessCached(counts, 200);
  } catch (err) {
    return handleServiceError(err);
  }
}

export const GET = withAuth(getHandler, PORTAL_DASHBOARD_PERMISSIONS);
