/**
 * Effective RBAC permissions: role.permissions merged with user.permissions.
 */
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
  return getEffectivePermissions(user).includes(permission);
}

export function userHasAnyEffectivePermission(user, permissions = []) {
  if (!permissions.length) return true;
  const effective = getEffectivePermissions(user);
  return permissions.some((p) => effective.includes(p));
}
