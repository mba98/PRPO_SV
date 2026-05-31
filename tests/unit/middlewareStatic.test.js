import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('middleware static asset exclusions', () => {
  const src = fs.readFileSync(path.resolve(process.cwd(), 'middleware.js'), 'utf8');

  it('uses explicit matcher exclusions for Next static and file extensions', () => {
    expect(src).toContain('_next/static');
    expect(src).toContain('_next/image');
    expect(src).toContain('favicon.ico');
    expect(src).toContain('woff2');
    expect(src).toContain('css|js');
    expect(src).not.toMatch(/\\\.\\\.\\\.\*/);
  });

  it('short-circuits static assets before auth logic', () => {
    expect(src).toContain('isStaticOrPublicAsset');
    expect(src).toContain("pathname.startsWith('/_next/static')");
    const middlewareStart = src.indexOf('export async function middleware');
    expect(src.indexOf('isStaticOrPublicAsset(pathname)', middlewareStart)).toBeGreaterThan(-1);
    expect(src.indexOf('await verifySessionToken', middlewareStart)).toBeGreaterThan(-1);
    expect(src.indexOf('isStaticOrPublicAsset(pathname)', middlewareStart)).toBeLessThan(
      src.indexOf('await verifySessionToken', middlewareStart),
    );
  });
});
