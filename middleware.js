import { NextResponse } from 'next/server';
import { verifySessionToken, SESSION_COOKIE_NAME, clearSessionCookieOnResponse } from '@/lib/sessionJwt.js';
import { isPublicApiRoute } from '@/lib/apiPublicRoutes.js';

const PUBLIC_PATHS = ['/login'];

const STATIC_FILE_PATTERN =
  /\.(?:png|jpe?g|gif|webp|svg|ico|css|js|woff2?|ttf|eot)$/i;

/**
 * Never run auth middleware on Next internals or public static files.
 * Prevents returning HTML redirects instead of CSS/JS (broken styling in fresh browsers).
 */
function isStaticOrPublicAsset(pathname) {
  if (
    pathname.startsWith('/_next/static') ||
    pathname.startsWith('/_next/image')
  ) {
    return true;
  }
  if (pathname === '/favicon.ico' || pathname === '/robots.txt' || pathname === '/sitemap.xml') {
    return true;
  }
  return STATIC_FILE_PATTERN.test(pathname);
}

function isPublicPage(pathname) {
  return PUBLIC_PATHS.includes(pathname);
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  if (isStaticOrPublicAsset(pathname)) {
    return NextResponse.next();
  }

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
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|woff|woff2|ttf|eot)$).*)',
  ],
};
