import { describe, expect, it } from 'vitest';
import {
  getSettingsPermissionForPath,
  canAccessSettingsPath,
} from '@/lib/settingsRoutePermissions';

describe('settingsRoutePermissions', () => {
  it('maps users path to admin.users', () => {
    expect(getSettingsPermissionForPath('/settings/users')).toEqual(['admin.users']);
  });

  it('maps system logs to admin.settings or view.all', () => {
    expect(getSettingsPermissionForPath('/settings/system-logs')).toEqual([
      'admin.settings',
      'view.all',
    ]);
  });

  it('denies requester without admin perms', () => {
    expect(canAccessSettingsPath(['pr.create'], '/settings/users')).toBe(false);
  });

  it('allows admin.users for users page', () => {
    expect(canAccessSettingsPath(['admin.users'], '/settings/users')).toBe(true);
  });

  it('allows view.all for system logs', () => {
    expect(canAccessSettingsPath(['view.all'], '/settings/system-logs')).toBe(true);
  });
});
