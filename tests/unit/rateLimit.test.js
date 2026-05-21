import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildLoginRateLimitKey,
  checkLoginRateLimit,
  clearLoginRateLimit,
  recordFailedLoginAttempt,
  resetLoginRateLimitStore,
} from '@/lib/rateLimit';

describe('login rate limit', () => {
  beforeEach(() => {
    resetLoginRateLimitStore();
  });

  it('allows attempts under the limit', () => {
    const key = buildLoginRateLimitKey('127.0.0.1', 'admin');
    expect(key).toBe('127.0.0.1:admin');
    expect(checkLoginRateLimit('127.0.0.1', 'admin').allowed).toBe(true);
    recordFailedLoginAttempt('127.0.0.1', 'admin');
    expect(checkLoginRateLimit('127.0.0.1', 'admin').allowed).toBe(true);
  });

  it('blocks after five failed attempts', () => {
    for (let i = 0; i < 5; i++) {
      recordFailedLoginAttempt('10.0.0.1', 'user1');
    }
    const result = checkLoginRateLimit('10.0.0.1', 'user1');
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('clears limit on successful login path', () => {
    recordFailedLoginAttempt('10.0.0.1', 'user1');
    clearLoginRateLimit('10.0.0.1', 'user1');
    expect(checkLoginRateLimit('10.0.0.1', 'user1').allowed).toBe(true);
  });
});
