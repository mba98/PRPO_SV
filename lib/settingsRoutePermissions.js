import { SETTINGS_NAV } from '@/lib/navigation.js';

/**
 * Required permissions for a settings route (any-of).
 */
export function getSettingsPermissionForPath(pathname) {
  const entry = SETTINGS_NAV.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  return entry?.permissions ?? ['admin.settings'];
}

export function canAccessSettingsPath(userPermissions, pathname) {
  const required = getSettingsPermissionForPath(pathname);
  if (!required?.length) return true;
  return required.some((p) => userPermissions.includes(p));
}
