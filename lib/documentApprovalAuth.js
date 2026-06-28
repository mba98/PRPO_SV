import { getEffectivePermissions, userHasEffectivePermission } from '@/lib/effectivePermissions.js';
import { getCurrentStep, resolveCurrentApprovalStep, pendingStatusForStep } from '@/lib/approvalEngine.js';
import {
  getCompletionPolicyDescription,
  isImplementedCompletionPolicy,
  normalizeCompletionPolicy,
} from '@/lib/approvalPolicies.js';
import { poStatusesEqual } from '@/lib/poStatus.js';
import { apriStatusesEqual } from '@/lib/apriStatus.js';
import { lpStatusesEqual } from '@/lib/localPurchaseStatus.js';

function userRoleId(user) {
  if (!user) return null;
  return user.role?._id?.toString?.() || user.role?.id?.toString?.() || user.role?.toString?.() || null;
}

function stepApproverRoleId(step) {
  const role = step?.approverRole;
  if (!role) return null;
  return role._id?.toString?.() || role.id?.toString?.() || role.toString?.() || null;
}

export function matchesApproverRole(user, step, documentType = 'PR') {
  if (!step?.approverRole) return true;
  const permissions = getEffectivePermissions(user);
  if (permissions.includes('system.super_admin')) return true;

  const stepRoleId = stepApproverRoleId(step);
  const userRole = userRoleId(user);
  if (stepRoleId && userRole && stepRoleId === userRole) return true;

  const stepRoleName = step.approverRole?.name;
  const userRoleName = user.roleName || user.role?.name;
  if (stepRoleName && userRoleName && stepRoleName === userRoleName) return true;

  return false;
}

export function documentStatusMatchesStep(document, step, documentType) {
  if (!step || !document) return false;
  const docType = String(documentType || 'PR').toUpperCase();
  const expected = pendingStatusForStep(step, documentType);
  if (docType === 'PO') {
    return poStatusesEqual(document.status, expected);
  }
  if (docType === 'APRI') {
    return apriStatusesEqual(document.status, expected);
  }
  if (docType === 'LOCAL_PURCHASE') {
    return lpStatusesEqual(document.status, expected);
  }
  return document.status === expected;
}

function userHasExactStepPermission(user, requiredPermission) {
  if (!requiredPermission) return false;
  return userHasEffectivePermission(user, requiredPermission);
}

/**
 * Shared approval authorization for PR / PO / APRI / LP (UI + API).
 * Requires exact current-step permission — view.all does NOT bypass.
 */
export function canUserApproveDocument({
  documentType,
  document,
  user,
  approvalSteps,
  step = null,
  logDiagnostics = process.env.NODE_ENV === 'development',
}) {
  const docType = String(documentType || 'PR').toUpperCase();
  const steps = approvalSteps || [];
  const currentStep =
    step ||
    resolveCurrentApprovalStep(steps, document, docType) ||
    getCurrentStep(steps, document?.currentApprovalStep);
  const permissions = getEffectivePermissions(user);

  const requiredPermission = currentStep?.requiredPermission || null;
  const hasRequiredPermission = userHasExactStepPermission(user, requiredPermission);
  const roleMatches = matchesApproverRole(user, currentStep, docType);
  const stepActive = currentStep?.isActive !== false;
  const policySupported = isImplementedCompletionPolicy(currentStep?.completionPolicy);
  const stepOrderMatches =
    currentStep != null &&
    (Number(document?.currentApprovalStep) === Number(currentStep.stepOrder) ||
      (docType === 'LOCAL_PURCHASE' &&
        lpStatusesEqual(document?.status, pendingStatusForStep(currentStep, docType))));
  const statusMatches = documentStatusMatchesStep(document, currentStep, docType);
  const matrixConfigured = Boolean(requiredPermission);

  const canApprove = Boolean(
    currentStep &&
      matrixConfigured &&
      stepActive &&
      stepOrderMatches &&
      statusMatches &&
      hasRequiredPermission &&
      roleMatches &&
      policySupported,
  );

  if (logDiagnostics && document) {
    console.log('[approval-auth]', {
      documentType: docType,
      documentStatus: document.status,
      currentApprovalStep: document.currentApprovalStep,
      matrixStepOrder: currentStep?.stepOrder,
      requiredPermission,
      matrixConfigured,
      completionPolicy: normalizeCompletionPolicy(currentStep?.completionPolicy),
      approverRole: currentStep?.approverRole,
      userRole: userRoleId(user),
      userRoleName: user?.roleName || user?.role?.name,
      userPermissions: permissions,
      hasRequiredPermission,
      matchesApproverRole: roleMatches,
      policySupported,
      statusMatches,
      stepOrderMatches,
      canApprove,
    });
  }

  return canApprove;
}

export function buildDocumentApprovalAccess({
  documentType,
  document,
  user,
  approvalSteps,
  step = null,
}) {
  const docType = String(documentType || 'PR').toUpperCase();
  const steps = approvalSteps || [];
  const currentStep =
    step ||
    resolveCurrentApprovalStep(steps, document, docType) ||
    getCurrentStep(steps, document?.currentApprovalStep);
  const canApprove = canUserApproveDocument({
    documentType: docType,
    document,
    user,
    approvalSteps: steps,
    step: currentStep,
    logDiagnostics: false,
  });

  const basePath =
    docType === 'PO'
      ? '/purchase-orders'
      : docType === 'APRI'
        ? '/ap-reserve-invoices'
        : docType === 'LOCAL_PURCHASE'
          ? '/local-purchases'
          : '/purchase-requests';

  const docId = document?.id || document?._id?.toString?.() || document?._id;
  const completionPolicy = normalizeCompletionPolicy(currentStep?.completionPolicy);

  return {
    canApprove,
    canApproveCurrentStep: canApprove,
    canRejectCurrentStep: canApprove,
    currentApprovalStep: document?.currentApprovalStep ?? null,
    currentStepName: currentStep?.stepName || null,
    currentStepRequiredPermission: currentStep?.requiredPermission || null,
    currentStepCompletionPolicy: completionPolicy,
    completionPolicyDescription: getCompletionPolicyDescription(completionPolicy),
    approveUrl: docId ? `${basePath}/${docId}/approve` : null,
  };
}

export function assertUserCanApproveDocument({
  documentType,
  document,
  user,
  approvalSteps,
  step = null,
  action = 'approve',
}) {
  const docType = String(documentType || 'PR').toUpperCase();
  const currentStep =
    step ||
    resolveCurrentApprovalStep(approvalSteps, document, docType) ||
    getCurrentStep(approvalSteps, document?.currentApprovalStep);

  if (!currentStep?.requiredPermission) {
    const err = new Error('Approval matrix step is missing a required permission.');
    err.code = 'MATRIX_MISCONFIGURED';
    throw err;
  }

  const canApprove = canUserApproveDocument({
    documentType: docType,
    document,
    user,
    approvalSteps,
    step: currentStep,
    logDiagnostics: true,
  });

  if (!canApprove) {
    let message = `You are not authorized to ${action} the current ${docType} step.`;
    let code = 'FORBIDDEN';

    if (docType === 'PR') {
      message = 'You are not authorized to approve the current PR step.';
    } else if (
      docType === 'LOCAL_PURCHASE' &&
      currentStep?.requiredPermission === 'lp.approve.finance'
    ) {
      code = 'LOCAL_PURCHASE_FINANCE_APPROVAL_FORBIDDEN';
      message = 'You are not authorized to approve the current Finance step.';
    } else if (
      docType === 'LOCAL_PURCHASE' &&
      currentStep?.requiredPermission === 'lp.approve.pm'
    ) {
      code = 'LOCAL_PURCHASE_PM_APPROVAL_FORBIDDEN';
      message = 'You are not authorized to approve the current Project Manager step.';
    }

    const err = new Error(message);
    err.code = code;
    throw err;
  }
}
