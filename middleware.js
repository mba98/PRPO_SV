import { NextResponse } from 'next/server';
import { verifySessionToken, SESSION_COOKIE_NAME, clearSessionCookieOnResponse } from '@/lib/sessionJwt.js';
import { isPublicApiRoute } from '@/lib/apiPublicRoutes.js';

const PUBLIC_PATHS = ['/login'];

function isPublicPage(pathname) {
  if (PUBLIC_PATHS.includes(pathname)) {
    return true;
  }
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon')) {
    return true;
  }
  return false;
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : { valid: false };

  if (pathname.startsWith('/api/')) {
    if (token && !session.valid && !isPublicApiRoute(request.method, pathname)) {
      const res = NextResponse.json(
        { success: false, message: 'Unauthorized', error: 'INVALID_SESSION' },
        { status: 401 },
      );
      return clearSessionCookieOnResponse(res);
    }
    return NextResponse.next();
  }

  if (isPublicPage(pathname)) {
    return NextResponse.next();
  }

  if (!session.valid) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    const res = NextResponse.redirect(loginUrl);
    if (token) {
      return clearSessionCookieOnResponse(res);
    }
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|.*\\..*).*)'],
};
