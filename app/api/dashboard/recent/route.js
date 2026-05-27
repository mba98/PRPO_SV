import { withAuth } from '@/lib/auth';
import { getDashboardRecent } from '@/lib/dashboardService';
import { jsonSuccess, handleServiceError } from '@/lib/apiHelpers';

async function getHandler(request, _ctx, user) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(20, parseInt(searchParams.get('limit') || '5', 10) || 5);
    const data = await getDashboardRecent(user, { limit });
    return jsonSuccess(data);
  } catch (err) {
    return handleServiceError(err);
  }
}

export const GET = withAuth(getHandler, [
  'pr.create',
  'pr.approve.whs',
  'pr.approve.pm',
  'po.create',
  'po.approve.pm',
  'po.approve.finance',
  'apinvoice.create',
  'view.all',
]);
