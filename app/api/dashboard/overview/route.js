import { withAuth } from '@/lib/auth';
import { getDashboardOverview } from '@/lib/dashboardService.js';
import { jsonSuccess, handleServiceError } from '@/lib/apiHelpers';
import { PORTAL_DASHBOARD_PERMISSIONS } from '@/lib/permissions.js';

async function getHandler(request, _ctx, user) {
  try {
    const limit = Math.min(
      20,
      Math.max(1, parseInt(new URL(request.url).searchParams.get('limit') || '5', 10) || 5),
    );
    const data = await getDashboardOverview(user, { limit });
    return jsonSuccess(data);
  } catch (err) {
    return handleServiceError(err);
  }
}

export const GET = withAuth(getHandler, PORTAL_DASHBOARD_PERMISSIONS);
