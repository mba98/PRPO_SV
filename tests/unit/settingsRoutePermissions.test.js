import { describe, expect, it } from 'vitest';
import {
  getSettingsPermissionForPath,
  canAccessSettingsPath,
} from '@/lib/settingsRoutePermissions';

describe('settingsRoutePermissions', () => {
  it('maps users path to admin.users', () => {
    expect(getSettingsPermissionForPath('/settings/users')).toEqual(['admin.users']);
  });

  it('maps system logs to admin.system_logs or legacy admin.settings', () => {
    expect(getSettingsPermissionForPath('/settings/system-logs')).toEqual([
      'admin.system_logs',
      'admin.settings',
    ]);
  });

  it('denies requester without admin perms', () => {
    expect(canAccessSettingsPath(['pr.create'], '/settings/users')).toBe(false);
  });

  it('allows admin.users for users page', () => {
    expect(canAccessSettingsPath(['admin.users'], '/settings/users')).toBe(true);
  });

  it('allows admin.system_logs for system logs', () => {
    expect(canAccessSettingsPath(['admin.system_logs'], '/settings/system-logs')).toBe(true);
  });

  it('does not allow view.all for system logs', () => {
    expect(canAccessSettingsPath(['view.all'], '/settings/system-logs')).toBe(false);
  });
});
