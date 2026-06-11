import {
  getApprovalSteps,
  getCurrentStep,
  pendingStatusForStep,
} from '@/lib/approvalEngine.js';
import { getEffectivePermissions, userHasAnyEffectivePermission } from '@/lib/effectivePermissions.js';
import {
  APRI_PROCUREMENT_PERMISSIONS,
  APRI_VIEW_PERMISSIONS,
  userIsApriMatrixApprover,
  userIsApriProcurement,
} from '@/lib/permissions.js';

export {
  APRI_PROCUREMENT_PERMISSIONS,
  APRI_VIEW_PERMISSIONS,
  APRI_MATRIX_APPROVER_PERMISSIONS,
  userIsApriProcurement,
  userIsApriMatrixApprover,
} from '@/lib/permissions.js';

/**
 * Permissions that may appear on APRI approval matrix steps (loaded from DB).
 */
export async function getApriMatrixApprovalPermissions() {
  const steps = await getApprovalSteps('APRI');
  return [...new Set(steps.map((s) => s.requiredPermission).filter(Boolean))];
}

/** API/nav guard: procurement + all matrix step permissions (resolved at call time in services). */
export async function getApriAccessPermissionKeys() {
  const matrix = await getApriMatrixApprovalPermissions();
  return [...new Set([...APRI_PROCUREMENT_PERMISSIONS, ...matrix])];
}

export async function userCanAccessApriWorkflow(user) {
  const permissions = getEffectivePermissions(user);
  if (userIsApriProcurement(permissions)) return true;
  const matrix = await getApriMatrixApprovalPermissions();
  return matrix.some((p) => permissions.includes(p));
}

export async function buildApriPendingApprovalFilter(user) {
  const steps = await getApprovalSteps('APRI');
  const permissions = getEffectivePermissions(user);

  if (permissions.includes('view.all')) {
    const statuses = steps.map((s) => pendingStatusForStep(s, 'APRI'));
    return { status: { $in: statuses } };
  }

  const or = [];
  for (const step of steps) {
    if (permissions.includes(step.requiredPermission)) {
      or.push({
        status: pendingStatusForStep(step, 'APRI'),
        currentApprovalStep: step.stepOrder,
      });
    }
  }
  return or.length ? { $or: or } : { _id: null };
}

export async function buildApriListAccessFilter(user) {
  const permissions = getEffectivePermissions(user);
  if (permissions.includes('view.all')) return {};

  const or = [];
  if (permissions.includes('apinvoice.create')) {
    or.push({ createdBy: user._id });
  }

  const pending = await buildApriPendingApprovalFilter(user);
  if (pending.$or) {
    or.push(...pending.$or);
  } else if (pending.status) {
    or.push(pending);
  }

  if (!or.length) return { _id: null };
  if (or.length === 1) return or[0];
  return { $or: or };
}

export async function userCanViewApriDocument(user, apri) {
  const permissions = getEffectivePermissions(user);
  if (permissions.includes('view.all')) return true;

  const creatorId = apri.createdBy?._id?.toString() || apri.createdBy?.toString();
  if (permissions.includes('apinvoice.create') && creatorId === user._id.toString()) {
    return true;
  }

  const steps = await getApprovalSteps('APRI');
  const step = getCurrentStep(steps, apri.currentApprovalStep);
  if (step && permissions.includes(step.requiredPermission)) {
    return apri.status === pendingStatusForStep(step, 'APRI');
  }

  return false;
}

export function canViewApriNav(user) {
  return userHasAnyEffectivePermission(user, APRI_VIEW_PERMISSIONS);
}
