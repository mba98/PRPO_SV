import { getEffectivePermissions } from '@/lib/effectivePermissions.js';
import { userCanAccessPoWorkflow } from '@/lib/poPermissions.js';
import {
  userIsApriMatrixApprover,
  userIsApriProcurement,
} from '@/lib/permissions.js';

/**
 * Mongo filters for documents the user is allowed to see (aligned with list/detail access).
 */
export function buildPrVisibilityFilter(user) {
  const permissions = getEffectivePermissions(user);
  if (permissions.includes('view.all')) return {};
  if (permissions.includes('pr.approve.whs') || permissions.includes('pr.approve.pm')) {
    return {};
  }
  return { requester: user._id };
}

export function buildPoVisibilityFilter(user) {
  const permissions = getEffectivePermissions(user);
  if (permissions.includes('view.all')) return {};
  if (userCanAccessPoWorkflow(permissions)) return {};
  return { requester: user._id };
}

export function buildApriVisibilityFilter(user) {
  const permissions = getEffectivePermissions(user);
  if (permissions.includes('view.all')) return {};
  if (userIsApriProcurement(permissions)) return {};
  if (userIsApriMatrixApprover(permissions)) return {};
  return { createdBy: user._id };
}

export function canViewEmailLogs(user) {
  const permissions = getEffectivePermissions(user);
  return permissions.includes('view.all') || permissions.includes('admin.settings');
}

export function canViewSapIntegrationLogs(user) {
  return canViewEmailLogs(user);
}
