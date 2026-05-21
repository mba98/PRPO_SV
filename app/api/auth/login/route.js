import { NextResponse } from 'next/server';
import { authenticateUser } from '@/lib/authLogin';
import { setSessionCookie } from '@/lib/auth';
import { failureResponse, successResponse, validationFailureResponse } from '@/lib/errors';
import { loginSchema, formatZodErrors } from '@/lib/validators/auth';
import { getClientIp } from '@/lib/requestUtils';

export async function POST(request) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(validationFailureResponse(formatZodErrors(parsed.error)), {
        status: 400,
      });
    }

    const clientIp = getClientIp(request);
    const result = await authenticateUser(parsed.data.username, parsed.data.password, clientIp);

    if (!result.ok) {
      return NextResponse.json(failureResponse(result.message, result.error), {
        status: result.status,
      });
    }

    const response = NextResponse.json(successResponse({ user: result.user }));
    return setSessionCookie(response, result.token);
  } catch (err) {
    console.error('[auth/login]', err.message);
    return NextResponse.json(
      failureResponse(
        'Unable to sign in. Please try again later.',
        'LOGIN_ERROR',
      ),
      { status: 500 },
    );
  }
}
