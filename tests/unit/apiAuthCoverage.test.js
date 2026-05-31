import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isPublicApiRoute, PUBLIC_API_ROUTES } from '@/lib/apiPublicRoutes.js';

const API_ROOT = path.resolve(process.cwd(), 'app/api');

function listRouteFiles(dir = API_ROOT) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listRouteFiles(full));
    } else if (entry.name === 'route.js') {
      files.push(full);
    }
  }
  return files;
}

function routePathFromFile(filePath) {
  const rel = path.relative(API_ROOT, filePath).replace(/\\/g, '/');
  const segments = rel.replace(/\/route\.js$/, '').split('/');
  return `/api/${segments.join('/')}`;
}

describe('apiAuthCoverage', () => {
  it('documents public auth routes', () => {
    expect(PUBLIC_API_ROUTES).toEqual(
      expect.arrayContaining([
        { method: 'POST', path: '/api/auth/login' },
        { method: 'GET', path: '/api/auth/me' },
        { method: 'POST', path: '/api/auth/logout' },
      ]),
    );
  });

  it('every API route uses withAuth or is on the public allowlist', () => {
    const routes = listRouteFiles();
    const violations = [];

    for (const file of routes) {
      const src = fs.readFileSync(file, 'utf8');
      const pathname = routePathFromFile(file);
      const usesWithAuth = /withAuth\s*\(/.test(src);
      const publicByAllowlist = PUBLIC_API_ROUTES.some((r) => pathname.startsWith(r.path));

      if (!usesWithAuth && !publicByAllowlist) {
        violations.push(pathname);
      }
    }

    expect(violations).toEqual([]);
  });

  it('isPublicApiRoute matches allowlisted auth endpoints', () => {
    expect(isPublicApiRoute('POST', '/api/auth/login')).toBe(true);
    expect(isPublicApiRoute('GET', '/api/auth/me')).toBe(true);
    expect(isPublicApiRoute('POST', '/api/auth/logout')).toBe(true);
    expect(isPublicApiRoute('GET', '/api/purchase-requests')).toBe(false);
  });
});
