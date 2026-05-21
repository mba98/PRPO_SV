import { getSessionFromRequest, getCurrentUser, sanitizeUser } from '@/lib/auth';
import { failureResponse, successResponse } from '@/lib/errors';

export async function GET(request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return Response.json(failureResponse('Unauthorized', 'AUTH_REQUIRED'), { status: 401 });
    }

    const user = await getCurrentUser(session);
    if (!user) {
      return Response.json(failureResponse('Unauthorized', 'INVALID_SESSION'), { status: 401 });
    }

    return Response.json(successResponse({ user: sanitizeUser(user) }));
  } catch (err) {
    return Response.json(
      failureResponse('Failed to load session', err.message || 'SESSION_ERROR'),
      { status: 500 },
    );
  }
}
