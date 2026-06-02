import { getEffectivePermissions } from '@/lib/effectivePermissions.js';

export const PR_STATUSES = [
  'Draft',
  'Pending Warehouse Approval',
  'Pending Project Manager Approval',
  'Approved',
  'Creating in SAP',
  'Created in SAP',
  'Failed to Create in SAP',
  'Rejected',
];

export const PR_POST_APPROVAL_STATUSES = [
  'Approved',
  'Creating in SAP',
  'Created in SAP',
  'Failed to Create in SAP',
];

export function canRetrySapPurchaseRequest(user) {
  const permissions = getEffectivePermissions(user);
  return (
    permissions.includes('view.all') ||
    permissions.includes('admin.settings') ||
    permissions.includes('pr.approve.pm')
  );
}

export function isPrApprover(user) {
  const permissions = getEffectivePermissions(user);
  return permissions.includes('pr.approve.whs') || permissions.includes('pr.approve.pm');
}

/**
 * Requester-only "Approved" tab scope; approvers and admins see all post-approval PRs.
 */
export function limitApprovedTabToOwnRequester(user) {
  const permissions = getEffectivePermissions(user);
  if (permissions.includes('view.all')) return false;
  if (isPrApprover(user)) return false;
  return true;
}
