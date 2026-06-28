import { describe, expect, it } from 'vitest';
import { ALL_PERMISSIONS } from '@/lib/permissions.js';
import { ACTIVE_PERMISSION_KEYS, ALL_REGISTRY_KEYS } from '@/lib/permissionRegistry.js';

describe('ALL_PERMISSIONS', () => {
  it('includes active registry keys and legacy migration keys', () => {
    expect(ALL_PERMISSIONS).toEqual(ALL_REGISTRY_KEYS);
    for (const key of ACTIVE_PERMISSION_KEYS) {
      expect(ALL_PERMISSIONS).toContain(key);
    }
    expect(ALL_PERMISSIONS).toContain('admin.system_logs');
    expect(ALL_PERMISSIONS).toContain('pr.edit');
    expect(ALL_PERMISSIONS).toContain('po.edit');
  });
});
