import { withAuth } from '@/lib/auth';
import { getDashboardSummary } from '@/lib/dashboardService';
import { jsonSuccess, handleServiceError } from '@/lib/apiHelpers';

async function getHandler(_request, _ctx, user) {
  try {
    const data = await getDashboardSummary(user);
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
