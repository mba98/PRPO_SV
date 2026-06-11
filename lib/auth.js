import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { AsyncLocalStorage } from 'node:async_hooks';
import '@/models/index.js';
import User from '@/models/User.js';
import { connectDB } from '@/lib/mongodb';
import { failureResponse } from '@/lib/errors';
import { getEffectivePermissions, userHasAnyEffectivePermission } from '@/lib/effectivePermissions.js';
import { perfAsync, perfEnd, perfStart } from '@/lib/perfLog.js';
import { runWithRequestTrace, traceMark, traceEnd } from '@/lib/requestTrace.js';
import {
  getJwtSecretKey,
  getSessionCookieOptions,
  SESSION_COOKIE_NAME,
} from '@/lib/jwtConfig.js';

const requestUserStore = new AsyncLocalStorage();

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

  const store = requestUserStore.getStore();
  if (store?.has(session.userId)) {
    return store.get(session.userId);
  }

  const user = await perfAsync('getCurrentUser', async () => {
    await connectDB();
    const row = await User.findById(session.userId)
      .populate('role', 'name permissions')
      .lean();

    if (!row || !row.isActive) {
      return null;
    }

    if (row.lockedUntil && new Date(row.lockedUntil) > new Date()) {
      return null;
    }

    const permissions = getEffectivePermissions(row);

    return {
      ...row,
      permissions,
      roleName: row.role?.name,
    };
  });

  store?.set(session.userId, user);
  return user;
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
    const path = new URL(request.url).pathname;
    return runWithRequestTrace(`${request.method} ${path}`, async () => {
      const perf = perfStart('withAuth total');
      const userCache = new Map();

      return requestUserStore.run(userCache, async () => {
        traceMark('auth-start');
        const session = await getSessionFromRequest(request);
        if (!session) {
          perfEnd(perf, 'unauthorized');
          traceEnd('401');
          return Response.json(failureResponse('Unauthorized', 'AUTH_REQUIRED'), { status: 401 });
        }

        const user = await getCurrentUser(session);
        traceMark('auth');
        if (!user) {
          perfEnd(perf, 'invalid session');
          traceEnd('401 session');
          return Response.json(failureResponse('Unauthorized', 'INVALID_SESSION'), { status: 401 });
        }

        if (!userHasPermission(user, requiredPermissions)) {
          perfEnd(perf, 'forbidden');
          traceEnd('403');
          return Response.json(failureResponse('Forbidden', 'INSUFFICIENT_PERMISSION'), {
            status: 403,
          });
        }

        const response = await handler(request, context, user);
        traceMark('serialize');
        perfEnd(perf, path);
        traceEnd('ok');
        return response;
      });
    });
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
