import { getEffectivePermissions } from '@/lib/effectivePermissions.js';
import { getCurrentStep, pendingStatusForStep } from '@/lib/approvalEngine.js';
import { poStatusesEqual } from '@/lib/poStatus.js';

function userRoleId(user) {
  if (!user) return null;
  return user.role?._id?.toString?.() || user.role?.id?.toString?.() || user.role?.toString?.() || null;
}

function stepApproverRoleId(step) {
  const role = step?.approverRole;
  if (!role) return null;
  return role._id?.toString?.() || role.id?.toString?.() || role.toString?.() || null;
}

export function matchesApproverRole(user, step) {
  if (!step?.approverRole) return true;
  const permissions = getEffectivePermissions(user);
  if (permissions.includes('view.all')) return true;

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
  const expected = pendingStatusForStep(step, documentType);
  if (String(documentType || 'PR').toUpperCase() === 'PO') {
    return poStatusesEqual(document.status, expected);
  }
  return document.status === expected;
}

/**
 * Shared approval authorization for PR / PO / APRI (UI + API).
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
  const currentStep = step || getCurrentStep(steps, document?.currentApprovalStep);
  const permissions = getEffectivePermissions(user);

  const hasRequiredPermission = Boolean(
    currentStep?.requiredPermission &&
      (permissions.includes(currentStep.requiredPermission) || permissions.includes('view.all')),
  );

  const roleMatches = matchesApproverRole(user, currentStep);
  const stepActive = currentStep?.isActive !== false;
  const stepOrderMatches =
    currentStep != null && Number(document?.currentApprovalStep) === Number(currentStep.stepOrder);
  const statusMatches = documentStatusMatchesStep(document, currentStep, docType);

  const canApprove = Boolean(
    currentStep && stepActive && stepOrderMatches && statusMatches && hasRequiredPermission && roleMatches,
  );

  if (logDiagnostics && document) {
    console.log('[approval-auth]', {
      documentType: docType,
      documentStatus: document.status,
      currentApprovalStep: document.currentApprovalStep,
      matrixStepOrder: currentStep?.stepOrder,
      requiredPermission: currentStep?.requiredPermission,
      approverRole: currentStep?.approverRole,
      userRole: userRoleId(user),
      userRoleName: user?.roleName || user?.role?.name,
      userPermissions: permissions,
      hasRequiredPermission,
      matchesApproverRole: roleMatches,
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
  const currentStep = step || getCurrentStep(steps, document?.currentApprovalStep);
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
        : '/purchase-requests';

  const docId = document?.id || document?._id?.toString?.() || document?._id;

  return {
    canApprove,
    canApproveCurrentStep: canApprove,
    canRejectCurrentStep: canApprove,
    currentApprovalStep: document?.currentApprovalStep ?? null,
    currentStepName: currentStep?.stepName || null,
    currentStepRequiredPermission: currentStep?.requiredPermission || null,
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
  const canApprove = canUserApproveDocument({
    documentType: docType,
    document,
    user,
    approvalSteps,
    step,
    logDiagnostics: true,
  });

  if (!canApprove) {
    const err = new Error(
      docType === 'PR'
        ? 'You are not authorized to approve the current PR step.'
        : `You are not authorized to ${action} the current ${docType} step.`,
    );
    err.code = 'FORBIDDEN';
    throw err;
  }
}
