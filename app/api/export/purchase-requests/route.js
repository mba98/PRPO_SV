import { withAuth } from '@/lib/auth';
import { parseExportQuery } from '@/lib/listQuery';
import { fetchPurchaseRequestsForExport } from '@/lib/purchaseRequestsService';
import { prRowsForExport, buildWorkbookBuffer, exportFilename } from '@/lib/excelExport';
import { handleServiceError } from '@/lib/apiHelpers';

const LIST_PERMS = ['pr.create', 'pr.approve.whs', 'pr.approve.pm', 'view.all'];

async function getHandler(request, _ctx, user) {
  try {
    const { limit, sort, order, searchParams } = parseExportQuery(request);
    const items = await fetchPurchaseRequestsForExport(user, {
      searchParams,
      sort,
      order,
      limit,
    });
    const rows = prRowsForExport(items);
    const buffer = buildWorkbookBuffer(rows, 'Purchase Requests');
    const filename = exportFilename('purchase-requests');
    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return handleServiceError(err);
  }
}

export const GET = withAuth(getHandler, LIST_PERMS);
