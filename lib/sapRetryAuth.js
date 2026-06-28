import {
  getEffectivePermissions,
  userHasAdminSapRetryAccess,
} from '@/lib/effectivePermissions.js';
import { matchesApproverRole } from '@/lib/documentApprovalAuth.js';
import { PO_STATUS, poStatusesEqual } from '@/lib/poStatus.js';

export { userHasAdminSapRetryAccess };

export function getFinalApprovalStep(steps = []) {
  const active = (steps || []).filter((step) => step.isActive !== false);
  if (!active.length) return null;
  return active[active.length - 1];
}

export function userCanActAsFinalStepApprover(user, finalStep, documentType) {
  if (!finalStep?.requiredPermission || !user) return false;
  if (userHasAdminSapRetryAccess(user)) return true;

  const permissions = getEffectivePermissions(user);
  if (!permissions.includes(finalStep.requiredPermission)) return false;

  return matchesApproverRole(user, finalStep, documentType);
}

export function userPerformedFinalApproval(userId, approvalHistory = [], finalStep) {
  if (!finalStep || !userId) return false;
  const uid = String(userId);
  const finalOrder = Number(finalStep.stepOrder);

  return approvalHistory.some((entry) => {
    if (entry.action !== 'Approved') return false;
    const actorId =
      entry.actionBy?._id?.toString?.() ||
      entry.actionBy?.toString?.() ||
      entry.actionBy?.id?.toString?.();
    if (actorId !== uid) return false;
    if (entry.stepOrder != null && Number(entry.stepOrder) === finalOrder) return true;
    if (finalStep.stepName && entry.stepName === finalStep.stepName) return true;
    return false;
  });
}

export function isDocumentEligibleForSapRetry(document, documentType) {
  const docType = String(documentType || 'PR').toUpperCase();
  if (docType === 'PR') {
    if (document?.sapPRDocEntry) return false;
    if (document?.status === 'Creating in SAP') return false;
    return ['Approved', 'Failed to Create in SAP'].includes(document?.status);
  }
  if (docType === 'PO') {
    if (document?.sapPODocEntry) return false;
    if (poStatusesEqual(document?.status, PO_STATUS.CREATING_IN_SAP)) return false;
    return (
      poStatusesEqual(document?.status, PO_STATUS.APPROVED) ||
      poStatusesEqual(document?.status, PO_STATUS.FAILED_SAP)
    );
  }
  return false;
}

/**
 * Whether the user may retry SAP creation for a fully approved document in SAP-failure state.
 */
export function canUserRetrySapDocument({
  user,
  documentType,
  document,
  approvalSteps = [],
  approvalHistory = [],
}) {
  if (!user || !document) return false;
  if (!isDocumentEligibleForSapRetry(document, documentType)) return false;
  if (userHasAdminSapRetryAccess(user)) return true;

  const finalStep = getFinalApprovalStep(approvalSteps);
  const userId = user._id?.toString?.() || user.id;

  if (userPerformedFinalApproval(userId, approvalHistory, finalStep)) return true;

  return userCanActAsFinalStepApprover(user, finalStep, documentType);
}
