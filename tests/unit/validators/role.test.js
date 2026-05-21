import { describe, expect, it } from 'vitest';
import { createRoleSchema, updateRoleSchema } from '@/lib/validators/role';

describe('createRoleSchema', () => {
  it('accepts valid role with permissions', () => {
    const result = createRoleSchema.safeParse({
      name: 'Custom Role',
      permissions: ['pr.create', 'view.all'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects unknown permissions', () => {
    const result = createRoleSchema.safeParse({
      name: 'Bad Role',
      permissions: ['invalid.permission'],
    });
    expect(result.success).toBe(false);
  });

  it('requires at least one permission', () => {
    const result = createRoleSchema.safeParse({
      name: 'Empty',
      permissions: [],
    });
    expect(result.success).toBe(false);
  });
});

describe('updateRoleSchema', () => {
  it('accepts permission updates', () => {
    const result = updateRoleSchema.safeParse({
      permissions: ['admin.users'],
    });
    expect(result.success).toBe(true);
  });
});
