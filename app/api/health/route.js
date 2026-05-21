import { withAuth } from '@/lib/auth';
import { checkAllDependencies } from '@/lib/health';
import { successResponse, failureResponse } from '@/lib/errors';

async function getHandler() {
  try {
    const result = await checkAllDependencies();
    const status = result.success ? 200 : 503;
    return Response.json(
      successResponse({
        dependencies: result.dependencies,
        checkedAt: result.checkedAt,
      }),
      { status },
    );
  } catch (err) {
    return Response.json(
      failureResponse('Health check failed', err.message || 'UNKNOWN_ERROR'),
      { status: 500 },
    );
  }
}

export const GET = withAuth(getHandler, ['admin.settings']);
