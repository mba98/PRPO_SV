import { getEffectivePermissions } from '@/lib/effectivePermissions.js';
import {
  documentStatusMatchesStep,
  matchesApproverRole,
} from '@/lib/documentApprovalAuth.js';
import {
  isLpEditableStatus,
  isPendingLpApprovalStatus,
  LP_STATUS,
  lpStatusesEqual,
  normalizeLpStatus,
  pendingLpStatusForStep,
} from '@/lib/localPurchaseStatus.js';
import { normalizeId } from '@/lib/normalizeId.js';

export const LP_CREATE_PERMISSION = 'lp.create';
export const LP_VIEW_ALL_PERMISSION = 'lp.view.all';
export const LP_CANCEL_PERMISSION = 'lp.cancel';
export const LP_APPROVAL_PERMISSIONS = ['lp.approve.pm', 'lp.approve.finance'];
export const LP_FINANCE_APPROVAL_PERMISSION = 'lp.approve.finance';
export const LP_PM_APPROVAL_PERMISSION = 'lp.approve.pm';

export const LP_ACCESS_PERMISSIONS = [
  LP_CREATE_PERMISSION,
  ...LP_APPROVAL_PERMISSIONS,
  LP_VIEW_ALL_PERMISSION,
];

export const LP_LIST_PERMISSIONS = LP_ACCESS_PERMISSIONS;

export function userHasAnyLpApprovalPermission(permissions) {
  return LP_APPROVAL_PERMISSIONS.some((p) => permissions.includes(p));
}

export function userIsLpCreator(user, doc) {
  return normalizeId(doc?.createdBy) === normalizeId(user?._id || user?.id);
}

export function userCanAccessLpWorkflow(permissions) {
  return LP_ACCESS_PERMISSIONS.some((p) => permissions.includes(p));
}

function userMatchesLpStepByStatus(user, doc, step) {
  if (!step || step.isActive === false) return false;
  const permissions = getEffectivePermissions(user);
  if (!permissions.includes(step.requiredPermission)) return false;
  if (!matchesApproverRole(user, step, 'LOCAL_PURCHASE')) return false;
  return lpStatusesEqual(doc?.status, pendingLpStatusForStep(step));
}

function userMatchesActiveLpStep(user, doc, step) {
  if (userMatchesLpStepByStatus(user, doc, step)) {
    if (documentStatusMatchesStep(doc, step, 'LOCAL_PURCHASE')) {
      return true;
    }
    // Allow when status matches the step even if currentApprovalStep pointer is stale.
    return true;
  }
  return false;
}

export function logLocalPurchaseFinanceAccessDiagnostics(user, doc, approvalSteps, result = {}) {
  if (process.env.NODE_ENV === 'production') return;
  const steps = approvalSteps || [];
  const currentStep = steps.find((step) => step.stepOrder === doc?.currentApprovalStep) || null;
  const permissions = getEffectivePermissions(user);
  console.log('Local Purchase Finance access', {
    documentId: doc?._id?.toString?.() || doc?.id,
    status: doc?.status,
    currentApprovalStep: doc?.currentApprovalStep,
    matrixPermission: currentStep?.requiredPermission,
    matrixRole: currentStep?.approverRole?.name || currentStep?.approverRole,
    userId: user?._id?.toString?.() || user?.id,
    userRole: user?.role?._id?.toString?.() || user?.role?.toString?.() || user?.role,
    userRoleName: user?.roleName || user?.role?.name,
    userPermissions: permissions,
    hasPermission: currentStep
      ? permissions.includes(currentStep.requiredPermission)
      : permissions.includes(LP_FINANCE_APPROVAL_PERMISSION),
    matchesRole: currentStep ? matchesApproverRole(user, currentStep, 'LOCAL_PURCHASE') : null,
    canView: result.canView,
    canApprove: result.canApprove,
  });
}

/**
 * Matrix-driven Local Purchase view access.
 * Pass approvalSteps from getApprovalSteps('LOCAL_PURCHASE') when available.
 */
export function userCanViewLocalPurchase(user, doc, approvalSteps = null) {
  const permissions = getEffectivePermissions(user);
  if (permissions.includes(LP_VIEW_ALL_PERMISSION) || permissions.includes('admin.settings')) {
    return true;
  }
  if (userIsLpCreator(user, doc)) return true;

  const status = normalizeLpStatus(doc?.status);
  const steps = Array.isArray(approvalSteps) ? approvalSteps : [];

  if (isPendingLpApprovalStatus(status)) {
    if (steps.length) {
      return steps.some((step) => userMatchesActiveLpStep(user, doc, step));
    }
    if (
      lpStatusesEqual(status, LP_STATUS.PENDING_FINANCE) &&
      permissions.includes(LP_FINANCE_APPROVAL_PERMISSION)
    ) {
      return true;
    }
    if (lpStatusesEqual(status, LP_STATUS.PENDING_PM) && permissions.includes(LP_PM_APPROVAL_PERMISSION)) {
      return true;
    }
    return userHasAnyLpApprovalPermission(permissions);
  }

  if (lpStatusesEqual(status, LP_STATUS.COMPLETED) || lpStatusesEqual(status, LP_STATUS.REJECTED)) {
    if (userHasAnyLpApprovalPermission(permissions)) return true;
    return permissions.includes(LP_CREATE_PERMISSION);
  }

  if (lpStatusesEqual(status, LP_STATUS.CANCELLED)) {
    return (
      userIsLpCreator(user, doc) ||
      permissions.includes(LP_CREATE_PERMISSION) ||
      userHasAnyLpApprovalPermission(permissions)
    );
  }

  return permissions.includes(LP_CREATE_PERMISSION) || userHasAnyLpApprovalPermission(permissions);
}

export function userCanEditLocalPurchase(user, doc) {
  const permissions = getEffectivePermissions(user);
  if (!isLpEditableStatus(doc.status)) return false;
  const isOwner = userIsLpCreator(user, doc);
  const adminOverride = permissions.includes('admin.settings');
  if (!isOwner && !adminOverride) return false;
  return permissions.includes(LP_CREATE_PERMISSION) || adminOverride;
}

export function userCanCancelLocalPurchase(user, doc) {
  const permissions = getEffectivePermissions(user);
  const norm = doc.status;
  const isOwner = userIsLpCreator(user, doc);
  const adminOverride = permissions.includes('admin.settings');

  if (lpStatusesEqual(norm, LP_STATUS.DRAFT) || lpStatusesEqual(norm, LP_STATUS.REJECTED)) {
    return isOwner && permissions.includes(LP_CANCEL_PERMISSION);
  }
  if (isPendingLpApprovalStatus(norm) || lpStatusesEqual(norm, LP_STATUS.COMPLETED)) {
    return adminOverride && permissions.includes(LP_CANCEL_PERMISSION);
  }
  return false;
}

export function userHasLpApprovalPermission(user, requiredPermission) {
  const permissions = getEffectivePermissions(user);
  return permissions.includes(requiredPermission);
}

export function userCanApproveCurrentLocalPurchaseStep(user, doc, approvalSteps) {
  const steps = approvalSteps || [];
  const currentStep = steps.find((step) => step.stepOrder === doc?.currentApprovalStep);
  if (!currentStep) return false;
  return userMatchesActiveLpStep(user, doc, currentStep);
}
