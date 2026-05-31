import { jwtVerify } from 'jose';
import { getJwtSecretKey, SESSION_COOKIE_NAME, getSessionCookieOptions } from '@/lib/jwtConfig.js';

export { SESSION_COOKIE_NAME };

/**
 * Edge-safe session verification (jose + env only, no Mongoose).
 */
export async function verifySessionToken(token) {
  if (!token) {
    return { valid: false };
  }
  try {
    const { payload } = await jwtVerify(token, getJwtSecretKey());
    return { valid: true, payload };
  } catch {
    return { valid: false };
  }
}

/**
 * Append cleared portal_session cookie to a NextResponse.
 */
export function clearSessionCookieOnResponse(response) {
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    ...getSessionCookieOptions(0),
    maxAge: 0,
  });
  return response;
}
