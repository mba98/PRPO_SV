/**
 * API routes that do not require withAuth (method + path prefix).
 * Used by apiAuthCoverage.test.js — update when adding public endpoints.
 */
export const PUBLIC_API_ROUTES = [
  { method: 'POST', path: '/api/auth/login' },
  { method: 'GET', path: '/api/auth/me' },
  { method: 'POST', path: '/api/auth/logout' },
];

export function isPublicApiRoute(method, pathname) {
  const upper = method.toUpperCase();
  return PUBLIC_API_ROUTES.some(
    (route) => upper === route.method && pathname.startsWith(route.path),
  );
}
