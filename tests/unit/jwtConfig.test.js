import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('jwtConfig', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('allows dev fallback when JWT_SECRET is unset in non-production', async () => {
    delete process.env.JWT_SECRET;
    process.env.NODE_ENV = 'test';
    const { getJwtSecretKey } = await import('@/lib/jwtConfig.js');
    const key = getJwtSecretKey();
    expect(key).toBeInstanceOf(Uint8Array);
    expect(key.length).toBeGreaterThan(0);
  });

  it('requires JWT_SECRET in production', async () => {
    delete process.env.JWT_SECRET;
    process.env.NODE_ENV = 'production';
    const { getJwtSecretKey } = await import('@/lib/jwtConfig.js');
    expect(() => getJwtSecretKey()).toThrow(/JWT_SECRET is required/);
  });

  it('requires minimum length in production', async () => {
    process.env.JWT_SECRET = 'short';
    process.env.NODE_ENV = 'production';
    const { getJwtSecretKey } = await import('@/lib/jwtConfig.js');
    expect(() => getJwtSecretKey()).toThrow(/at least 32/);
  });

  it('uses strict sameSite for session cookie in production', async () => {
    process.env.NODE_ENV = 'production';
    const { getSessionCookieOptions } = await import('@/lib/jwtConfig.js');
    expect(getSessionCookieOptions().sameSite).toBe('strict');
  });

  it('uses lax sameSite for session cookie in development', async () => {
    process.env.NODE_ENV = 'development';
    const { getSessionCookieOptions } = await import('@/lib/jwtConfig.js');
    expect(getSessionCookieOptions().sameSite).toBe('lax');
  });
});
