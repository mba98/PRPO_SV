import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import '@/models/index.js';
import User from '@/models/User.js';
import { connectDB } from '@/lib/mongodb';
import { failureResponse } from '@/lib/errors';
import { getEffectivePermissions, userHasAnyEffectivePermission } from '@/lib/effectivePermissions.js';
import {
  getJwtSecretKey,
  getSessionCookieOptions,
  SESSION_COOKIE_NAME,
} from '@/lib/jwtConfig.js';

const COOKIE_NAME = SESSION_COOKIE_NAME;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

function getJwtSecret() {
  return getJwtSecretKey();
}

function parseExpirySeconds(expiry) {
  const match = expiry.match(/^(\d+)([hms])$/);
  if (!match) {
    return 8 * 60 * 60;
  }
  const value = parseInt(match[1], 10);
  const unit = match[2];
  if (unit === 'h') return value * 3600;
  if (unit === 'm') return value * 60;
  return value;
}

/**
 * Sign a JWT for the given user payload.
 */
export async function signToken(payload) {
  const expiresInSeconds = parseExpirySeconds(JWT_EXPIRES_IN);
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${expiresInSeconds}s`)
    .sign(getJwtSecret());
}

/**
 * Verify JWT string and return payload.
 */
export async function verifyToken(token) {
  const { payload } = await jwtVerify(token, getJwtSecret());
  return payload;
}

export function getSessionCookieName() {
  return COOKIE_NAME;
}

/**
 * Read session from httpOnly cookie.
 */
export async function getSessionFromRequest(request) {
  const cookieStore = cookies();
  let token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token && request?.headers?.get) {
    const cookieHeader = request.headers.get('cookie') || '';
    const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
    token = match?.[1];
  }

  if (!token) {
    return null;
  }

  try {
    return await verifyToken(token);
  } catch {
    return null;
  }
}

/**
 * Load active user with role permissions from session payload.
 */
export async function getCurrentUser(session) {
  if (!session?.userId) {
    return null;
  }

  await connectDB();
  const user = await User.findById(session.userId)
    .populate('role')
    .lean();

  if (!user || !user.isActive) {
    return null;
  }

  if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
    return null;
  }

  const permissions = getEffectivePermissions(user);

  return {
    ...user,
    permissions,
    roleName: user.role?.name,
  };
}

export function userHasPermission(user, requiredPermissions) {
  return userHasAnyEffectivePermission(user, requiredPermissions);
}

export { getEffectivePermissions } from '@/lib/effectivePermissions.js';

/**
 * Wrap an API route handler with JWT auth and permission checks.
 */
export function withAuth(handler, requiredPermissions = []) {
  return async function authenticatedHandler(request, context) {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return Response.json(failureResponse('Unauthorized', 'AUTH_REQUIRED'), { status: 401 });
    }

    const user = await getCurrentUser(session);
    if (!user) {
      return Response.json(failureResponse('Unauthorized', 'INVALID_SESSION'), { status: 401 });
    }

    if (!userHasPermission(user, requiredPermissions)) {
      return Response.json(failureResponse('Forbidden', 'INSUFFICIENT_PERMISSION'), {
        status: 403,
      });
    }

    return handler(request, context, user);
  };
}

function getCookieMaxAgeSeconds() {
  return parseExpirySeconds(JWT_EXPIRES_IN);
}

/**
 * Set httpOnly portal_session cookie on the response.
 */
export function setSessionCookie(response, token) {
  response.cookies.set(COOKIE_NAME, token, {
    ...getSessionCookieOptions(getCookieMaxAgeSeconds()),
    maxAge: getCookieMaxAgeSeconds(),
  });
  return response;
}

/**
 * Clear portal_session cookie (must match setSessionCookie path/options).
 */
export function clearSessionCookie(response) {
  response.cookies.set(COOKIE_NAME, '', {
    ...getSessionCookieOptions(0),
    maxAge: 0,
  });
  return response;
}

export { sanitizeUser } from '@/lib/authLogin';
