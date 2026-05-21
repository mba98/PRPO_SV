import { describe, expect, it } from 'vitest';
import { signToken, verifyToken, userHasPermission } from '@/lib/auth';

describe('auth helpers', () => {
  it('signs and verifies a JWT payload', async () => {
    const token = await signToken({ userId: '507f1f77bcf86cd799439011', username: 'admin' });
    const payload = await verifyToken(token);
    expect(payload.username).toBe('admin');
    expect(payload.userId).toBe('507f1f77bcf86cd799439011');
  });

  it('checks user permissions', () => {
    const user = { permissions: ['admin.settings', 'view.all'] };
    expect(userHasPermission(user, ['admin.settings'])).toBe(true);
    expect(userHasPermission(user, ['pr.create'])).toBe(false);
    expect(userHasPermission(user, [])).toBe(true);
  });
});
