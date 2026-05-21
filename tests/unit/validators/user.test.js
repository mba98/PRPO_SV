import { describe, expect, it } from 'vitest';
import { createUserSchema, updateUserSchema } from '@/lib/validators/user';

const validRoleId = '507f1f77bcf86cd799439011';

describe('createUserSchema', () => {
  it('accepts valid user payload', () => {
    const result = createUserSchema.safeParse({
      name: 'Test User',
      email: 'test@example.com',
      username: 'testuser',
      password: 'password123',
      role: validRoleId,
    });
    expect(result.success).toBe(true);
  });

  it('rejects short password', () => {
    const result = createUserSchema.safeParse({
      name: 'Test',
      email: 'test@example.com',
      username: 'test',
      password: 'short',
      role: validRoleId,
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid role id', () => {
    const result = createUserSchema.safeParse({
      name: 'Test',
      email: 'test@example.com',
      username: 'test',
      password: 'password123',
      role: 'invalid',
    });
    expect(result.success).toBe(false);
  });
});

describe('updateUserSchema', () => {
  it('allows partial updates without password', () => {
    const result = updateUserSchema.safeParse({ name: 'Updated Name' });
    expect(result.success).toBe(true);
  });
});
