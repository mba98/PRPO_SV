/**
 * Effective RBAC permissions: role.permissions merged with user.permissions.
 */
export function getEffectivePermissions(user) {
  if (!user) return [];
  const rolePerms = user.role?.permissions || [];
  const direct = user.permissions || [];
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
