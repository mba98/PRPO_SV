import { withAuth } from '@/lib/auth';
import { parseExportQuery } from '@/lib/listQuery';
import { fetchApReserveInvoicesForExport } from '@/lib/apReserveInvoicesService';
import { apriRowsForExport, buildWorkbookBuffer, exportFilename } from '@/lib/excelExport';
import { handleServiceError } from '@/lib/apiHelpers';

import { APRI_VIEW_PERMISSIONS } from '@/lib/apriPermissions.js';

const LIST_PERMS = APRI_VIEW_PERMISSIONS;

async function getHandler(request, _ctx, user) {
  try {
    const { limit, sort, order, searchParams } = parseExportQuery(request);
    const items = await fetchApReserveInvoicesForExport(user, {
      searchParams,
      sort,
      order,
      limit,
    });
    const rows = apriRowsForExport(items);
    const buffer = buildWorkbookBuffer(rows, 'AP Reserve Invoices');
    const filename = exportFilename('ap-reserve-invoices');
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
