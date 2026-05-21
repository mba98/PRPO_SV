import { describe, expect, it } from 'vitest';
import { ALL_PERMISSIONS } from '@/lib/permissions';
import { ALL_PERMISSIONS as SEED_PERMISSIONS } from '@/seed/roles';

describe('ALL_PERMISSIONS', () => {
  it('matches seed export and includes admin permissions', () => {
    expect(ALL_PERMISSIONS).toEqual(SEED_PERMISSIONS);
    expect(ALL_PERMISSIONS).toContain('admin.users');
    expect(ALL_PERMISSIONS).toContain('admin.roles');
    expect(ALL_PERMISSIONS).toContain('admin.approval_matrix');
  });
});
