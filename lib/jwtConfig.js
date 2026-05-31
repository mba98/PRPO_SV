const MIN_JWT_SECRET_LENGTH = 32;
const DEV_FALLBACK_SECRET = 'development-secret-change-me';

export const SESSION_COOKIE_NAME = 'portal_session';

/**
 * Raw JWT secret from environment (may be empty).
 */
export function getJwtSecretRaw() {
  return (process.env.JWT_SECRET || '').trim();
}

/**
 * Encoded secret for jose SignJWT / jwtVerify.
 * Production requires JWT_SECRET with length >= MIN_JWT_SECRET_LENGTH.
 * Non-production may use a documented dev fallback when unset.
 */
export function getJwtSecretKey() {
  const raw = getJwtSecretRaw();
  if (raw) {
    if (process.env.NODE_ENV === 'production' && raw.length < MIN_JWT_SECRET_LENGTH) {
      throw new Error(
        `JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters in production`,
      );
    }
    return new TextEncoder().encode(raw);
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is required in production');
  }

  return new TextEncoder().encode(DEV_FALLBACK_SECRET);
}

/**
 * Fail fast on app bootstrap when JWT configuration is invalid.
 */
export function assertJwtConfigForRuntime() {
  getJwtSecretKey();
}

/**
 * Whether portal_session uses the Secure cookie flag.
 * Set COOKIE_SECURE=false for internal HTTP deployments (e.g. http://host:5420).
 * When unset, defaults to true only in production (NODE_ENV=production).
 */
export function getCookieSecure() {
  return process.env.COOKIE_SECURE != null
    ? process.env.COOKIE_SECURE === 'true'
    : process.env.NODE_ENV === 'production';
}

/**
 * Shared portal_session cookie options.
 * sameSite: lax in dev; strict in production (CSRF mitigation).
 */
export function getSessionCookieOptions(maxAge) {
  const isProduction = process.env.NODE_ENV === 'production';
  const options = {
    httpOnly: true,
    secure: getCookieSecure(),
    // lax avoids breaking normal top-level navigation in dev; strict in prod per Phase 2a
    sameSite: isProduction ? 'strict' : 'lax',
    path: '/',
  };
  if (maxAge !== undefined) {
    options.maxAge = maxAge;
  }
  return options;
}
