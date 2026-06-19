import { getEffectivePermissions } from '@/lib/effectivePermissions.js';

/**
 * Normalize permission keys from user/session payloads (strings only in this app).
 */
export function normalizeUserPermissionKeys(user) {
  return getEffectivePermissions(user);
}

export function userHasPermissionKey(user, permissionKey) {
  return normalizeUserPermissionKeys(user).includes(permissionKey);
}

/** @deprecated Alias for userHasPermissionKey */
export const userHasPermission = userHasPermissionKey;
