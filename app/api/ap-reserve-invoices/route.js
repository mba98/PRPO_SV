import { withAuth } from '@/lib/auth';
import { parseListQuery } from '@/lib/errors';
import { listApReserveInvoices } from '@/lib/apReserveInvoicesService';
import { jsonSuccess, handleServiceError } from '@/lib/apiHelpers';

async function getHandler(request, _ctx, user) {
  try {
    const { page, limit, sort, order, searchParams } = parseListQuery(request);
    const { items, pagination } = await listApReserveInvoices(user, {
      page,
      limit,
      sort,
      order,
      searchParams,
    });
    return jsonSuccess(items, pagination);
  } catch (err) {
    return handleServiceError(err);
  }
}

export const GET = withAuth(getHandler, ['apinvoice.create', 'view.all']);
