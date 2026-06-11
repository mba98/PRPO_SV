import { getEffectivePermissions } from '@/lib/effectivePermissions.js';
import { isPoEditableStatus, isPoNonEditableStatus } from '@/lib/poStatus.js';

const EDIT_PERMISSIONS = ['po.create', 'view.all', 'admin.settings'];

export function canEditPurchaseOrder(user, po) {
  const permissions = getEffectivePermissions(user);
  if (!EDIT_PERMISSIONS.some((p) => permissions.includes(p))) return false;
  if (po.sapPODocEntry) return false;
  if (isPoNonEditableStatus(po.status)) return false;
  return isPoEditableStatus(po.status);
}
