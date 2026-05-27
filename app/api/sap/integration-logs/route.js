import { withAuth } from '@/lib/auth';
import { parseListQuery } from '@/lib/listQuery';
import { SAP_LOG_SORT_FIELDS, resolveSortField } from '@/lib/listQuery';
import { listSapIntegrationLogs } from '@/lib/sapIntegrationLogsService';
import { jsonSuccess, handleServiceError } from '@/lib/apiHelpers';

async function getHandler(request, _ctx, user) {
  try {
    const parsed = parseListQuery(request);
    const sort = resolveSortField(parsed.sort, SAP_LOG_SORT_FIELDS, 'createdAt');
    const { items, pagination } = await listSapIntegrationLogs(user, {
      ...parsed,
      sort,
    });
    return jsonSuccess(items, pagination);
  } catch (err) {
    return handleServiceError(err);
  }
}

export const GET = withAuth(getHandler, ['admin.settings', 'view.all']);
