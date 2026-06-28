/**
 * Effective RBAC permissions: role.permissions merged with user.permissions.
 */
import { PERMISSION_LEGACY_ALIASES } from '@/lib/permissionRegistry.js';

function extractPermissionKey(permission) {
  if (!permission) return null;
  if (typeof permission === 'string') return permission;
  if (typeof permission === 'object' && permission.key) return permission.key;
  return null;
}

function normalizePermissionList(permissions = []) {
  return permissions.map(extractPermissionKey).filter(Boolean);
}

export function getEffectivePermissions(user) {
  if (!user) return [];
  const rolePerms = normalizePermissionList(user.role?.permissions || []);
  const direct = normalizePermissionList(user.permissions || []);
  return [...new Set([...rolePerms, ...direct])];
}

export function userHasEffectivePermission(user, permission) {
  if (!permission) return false;
  const effective = getEffectivePermissions(user);
  if (effective.includes('system.super_admin')) return true;
  if (effective.includes(permission)) return true;
  const aliases = PERMISSION_LEGACY_ALIASES[permission] || [];
  return aliases.some((alias) => effective.includes(alias));
}

export function userHasAnyEffectivePermission(user, permissions = []) {
  if (!permissions.length) return true;
  return permissions.some((p) => userHasEffectivePermission(user, p));
}

/** Admin SAP operational override — not view.all. */
export function userHasAdminSapRetryAccess(user) {
  const permissions = getEffectivePermissions(user);
  if (permissions.includes('system.super_admin')) return true;
  return (
    permissions.includes('admin.settings') ||
    permissions.includes('sap.pr.retry') ||
    permissions.includes('sap.po.retry') ||
    permissions.includes('sap.apri.retry')
  );
}

/** Development-only permission diagnostics (never attach to API responses). */
export function buildPermissionDiagnostics(user) {
  if (process.env.NODE_ENV === 'production') return null;
  if (!user) return null;
  return {
    user: user.username || user.email || user._id?.toString?.(),
    role: user.roleName || user.role?.name || null,
    rolePermissions: normalizePermissionList(user.role?.permissions || []),
    userPermissions: normalizePermissionList(user.permissions || []),
    effectivePermissions: getEffectivePermissions(user),
  };
}
