import { withAuth } from '@/lib/auth';
import { getDashboardSummary } from '@/lib/dashboardService';
import { jsonSuccess, handleServiceError } from '@/lib/apiHelpers';
import { PORTAL_DASHBOARD_PERMISSIONS } from '@/lib/permissions.js';

async function getHandler(_request, _ctx, user) {
  try {
    const data = await getDashboardSummary(user);
    return jsonSuccess(data);
  } catch (err) {
    return handleServiceError(err);
  }
}

export const GET = withAuth(getHandler, PORTAL_DASHBOARD_PERMISSIONS);
