import { describe, expect, it } from 'vitest';
import {
  ACTIVE_PERMISSION_KEYS,
  PERMISSION_REGISTRY,
} from '@/lib/permissionRegistry.js';
import {
  ALL_PERMISSIONS,
  PERMISSION_GROUPS,
  PR_APPROVAL_PERMISSIONS,
  ROLES_PICKLIST_PERMISSIONS,
} from '@/lib/permissions';

describe('permission groups', () => {
  it('covers every active permission in groups', () => {
    const grouped = PERMISSION_GROUPS.flatMap((g) => g.permissions);
    for (const key of ACTIVE_PERMISSION_KEYS) {
      expect(grouped).toContain(key);
    }
  });

  it('PR approval permissions are in registry', () => {
    for (const p of PR_APPROVAL_PERMISSIONS) {
      expect(ACTIVE_PERMISSION_KEYS).toContain(p);
    }
  });

  it('roles picklist allows cross-admin dropdown access', () => {
    expect(ROLES_PICKLIST_PERMISSIONS).toContain('admin.settings');
    expect(ROLES_PICKLIST_PERMISSIONS).toContain('admin.approval_matrix');
  });

  it('legacy apinvoice.create remains in ALL_PERMISSIONS for migration', () => {
    expect(ALL_PERMISSIONS).toContain('apinvoice.create');
    expect(PERMISSION_REGISTRY.find((p) => p.key === 'apinvoice.create')?.active).toBe(false);
  });
});
