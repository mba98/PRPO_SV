import {
  getApprovalSteps,
  getCurrentStep,
  pendingStatusForStep,
} from '@/lib/approvalEngine.js';
import { getEffectivePermissions, userHasAnyEffectivePermission } from '@/lib/effectivePermissions.js';

export const APRI_PROCUREMENT_PERMISSIONS = ['apinvoice.create', 'view.all'];

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

/**
 * Sync superset for route guards and sidebar (includes current seed matrix permission).
 * Service-layer checks still use live matrix via getApprovalSteps().
 */
export const APRI_VIEW_PERMISSIONS = [...APRI_PROCUREMENT_PERMISSIONS, 'pr.approve.whs'];

/** Matrix approver permissions (sync superset for nav/visibility guards). */
export const APRI_MATRIX_APPROVER_PERMISSIONS = APRI_VIEW_PERMISSIONS.filter(
  (p) => !APRI_PROCUREMENT_PERMISSIONS.includes(p),
);

export function userIsApriProcurement(permissions) {
  return APRI_PROCUREMENT_PERMISSIONS.some((p) => permissions.includes(p));
}

export function userIsApriMatrixApprover(permissions) {
  return APRI_MATRIX_APPROVER_PERMISSIONS.some((p) => permissions.includes(p));
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
