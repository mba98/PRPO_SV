import { withAuth } from '@/lib/auth';
import { listEmailLogsQuerySchema } from '@/lib/validators/emailLog';
import { listEmailLogs } from '@/lib/emailLogsService';
import {
  jsonSuccess,
  jsonValidation,
  handleServiceError,
} from '@/lib/apiHelpers';

async function getHandler(request, _ctx, user) {
  try {
    const { searchParams } = new URL(request.url);
    const raw = Object.fromEntries(searchParams.entries());
    const parsed = listEmailLogsQuerySchema.safeParse(raw);
    if (!parsed.success) {
      return jsonValidation(parsed.error);
    }
    const { page = 1, limit = 25, ...filters } = parsed.data;
    const result = await listEmailLogs(user, { page, limit, ...filters });
    return jsonSuccess(result.items, result.pagination);
  } catch (err) {
    return handleServiceError(err);
  }
}

export const GET = withAuth(getHandler, ['admin.settings', 'view.all']);
