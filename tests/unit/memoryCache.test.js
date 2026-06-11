import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cacheClear, cacheGet, cacheSet } from '@/lib/memoryCache.js';

describe('memoryCache', () => {
  beforeEach(() => {
    cacheClear();
    vi.useFakeTimers();
  });

  it('stores and retrieves values before TTL expiry', () => {
    cacheSet('key', { ok: true }, 1000);
    expect(cacheGet('key')).toEqual({ ok: true });
  });

  it('expires values after TTL', () => {
    cacheSet('key', 'value', 1000);
    vi.advanceTimersByTime(1001);
    expect(cacheGet('key')).toBeUndefined();
  });
});
