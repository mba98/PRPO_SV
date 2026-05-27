import { describe, expect, it } from 'vitest';
import {
  ALL_PERMISSIONS,
  PERMISSION_GROUPS,
  PR_APPROVAL_PERMISSIONS,
  ROLES_PICKLIST_PERMISSIONS,
} from '@/lib/permissions';

describe('permission groups', () => {
  it('covers every permission in groups', () => {
    const grouped = PERMISSION_GROUPS.flatMap((g) => g.permissions);
    expect(grouped.sort()).toEqual([...ALL_PERMISSIONS].sort());
  });

  it('PR approval permissions are subset of all', () => {
    for (const p of PR_APPROVAL_PERMISSIONS) {
      expect(ALL_PERMISSIONS).toContain(p);
    }
  });

  it('roles picklist allows cross-admin dropdown access', () => {
    expect(ROLES_PICKLIST_PERMISSIONS).toContain('admin.settings');
    expect(ROLES_PICKLIST_PERMISSIONS).toContain('admin.approval_matrix');
  });
});
