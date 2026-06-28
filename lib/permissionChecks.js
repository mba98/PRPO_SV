import { getEffectivePermissions } from '@/lib/effectivePermissions.js';
import { PERMISSION_LEGACY_ALIASES } from '@/lib/permissionRegistry.js';

/**
 * Whether the user holds a permission, including documented legacy aliases.
 * Does NOT treat view.all as a wildcard for other permissions.
 */
export function userHasPermissionKey(user, permission) {
  if (!permission) return false;
  const effective = getEffectivePermissions(user);
  if (effective.includes('system.super_admin')) return true;
  if (effective.includes(permission)) return true;
  const aliases = PERMISSION_LEGACY_ALIASES[permission] || [];
  return aliases.some((alias) => effective.includes(alias));
}

export function userHasAnyPermissionKey(user, permissions = []) {
  if (!permissions.length) return true;
  return permissions.some((p) => userHasPermissionKey(user, p));
}

/** Read-only global visibility — never grants mutation permissions. */
export function userHasGlobalReadAccess(user) {
  return userHasAnyPermissionKey(user, ['view.all', 'pr.view.all', 'po.view.all', 'apri.view.all']);
}
