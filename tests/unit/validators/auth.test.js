import { describe, expect, it } from 'vitest';
import { loginSchema, formatZodErrors } from '@/lib/validators/auth';

describe('loginSchema', () => {
  it('accepts valid credentials', () => {
    const result = loginSchema.safeParse({ username: 'admin', password: 'secret' });
    expect(result.success).toBe(true);
  });

  it('rejects empty username', () => {
    const result = loginSchema.safeParse({ username: '', password: 'secret' });
    expect(result.success).toBe(false);
    const errors = formatZodErrors(result.error);
    expect(errors.some((e) => e.path === 'username')).toBe(true);
  });

  it('rejects missing password', () => {
    const result = loginSchema.safeParse({ username: 'admin' });
    expect(result.success).toBe(false);
  });
});
