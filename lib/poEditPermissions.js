import { getEffectivePermissions } from '@/lib/effectivePermissions.js';

const EDIT_PERMISSIONS = ['po.create', 'view.all', 'admin.settings'];

const EDITABLE_STATUSES = new Set([
  'Draft',
  'Rejected',
  'Pending Project Manager Approval',
  'Pending Operation Manager Approval',
  'Pending Finance Approval',
  'Approved',
  'Failed to Create in SAP',
]);

const NON_EDITABLE_STATUSES = new Set(['Creating in SAP', 'Created in SAP']);

export function canEditPurchaseOrder(user, po) {
  const permissions = getEffectivePermissions(user);
  if (!EDIT_PERMISSIONS.some((p) => permissions.includes(p))) return false;
  if (po.sapPODocEntry) return false;
  if (NON_EDITABLE_STATUSES.has(po.status)) return false;
  return EDITABLE_STATUSES.has(po.status);
}
