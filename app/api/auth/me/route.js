import { getSessionFromRequest, getCurrentUser, sanitizeUser } from '@/lib/auth';
import { buildPermissionDiagnostics } from '@/lib/effectivePermissions.js';
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

    const payload = { user: sanitizeUser(user) };
    const diagnostics = buildPermissionDiagnostics(user);
    if (diagnostics) {
      payload._permissionDiagnostics = diagnostics;
    }

    return Response.json(successResponse(payload));
  } catch (err) {
    return Response.json(
      failureResponse('Failed to load session', err.message || 'SESSION_ERROR'),
      { status: 500 },
    );
  }
}
