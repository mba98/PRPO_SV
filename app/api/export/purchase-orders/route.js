import { withAuth } from '@/lib/auth';
import { parseExportQuery } from '@/lib/listQuery';
import { fetchPurchaseOrdersForExport } from '@/lib/purchaseOrdersService';
import { poRowsForExport, buildWorkbookBuffer, exportFilename } from '@/lib/excelExport';
import { handleServiceError } from '@/lib/apiHelpers';

const LIST_PERMS = ['po.create', 'po.approve.pm', 'po.approve.finance', 'view.all'];

async function getHandler(request, _ctx, user) {
  try {
    const { limit, sort, order, searchParams } = parseExportQuery(request);
    const items = await fetchPurchaseOrdersForExport(user, {
      searchParams,
      sort,
      order,
      limit,
    });
    const rows = poRowsForExport(items);
    const buffer = buildWorkbookBuffer(rows, 'Purchase Orders');
    const filename = exportFilename('purchase-orders');
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
