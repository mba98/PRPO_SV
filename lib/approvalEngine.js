import '@/models/index.js';
import ApprovalMatrix from '@/models/ApprovalMatrix.js';
import { connectDB } from '@/lib/mongodb';
import { getEffectivePermissions } from '@/lib/effectivePermissions.js';
import { PO_STATUS, pendingPoStatusForStep } from '@/lib/poStatus.js';

/** Legacy fallback when matrix row has no pendingStatus (PR / older seeds). */
const LEGACY_PERMISSION_STATUS = {
  'pr.approve.whs': 'Pending Warehouse Approval',
  'pr.approve.pm': 'Pending Project Manager Approval',
};

/**
 * Load active approval steps for a document type, ordered by stepOrder.
 */
export async function getApprovalSteps(documentType) {
  await connectDB();
  const docType = String(documentType || '').trim().toUpperCase();
  return ApprovalMatrix.find({ documentType: docType, isActive: true })
    .sort({ stepOrder: 1 })
    .populate('approverRole', 'name')
    .lean();
}

export function getCurrentStep(steps, currentApprovalStep) {
  if (!steps?.length || !currentApprovalStep) return null;
  return steps.find((s) => s.stepOrder === currentApprovalStep) || null;
}

export function pendingStatusForPermission(requiredPermission) {
  return LEGACY_PERMISSION_STATUS[requiredPermission] || 'Pending Approval';
}

export function pendingStatusForStep(step, documentType = 'PR') {
  if (!step) return null;
  if (documentType === 'PO') {
    return pendingPoStatusForStep(step);
  }
  if (step.pendingStatus?.trim()) return step.pendingStatus.trim();
  const legacy = LEGACY_PERMISSION_STATUS[step.requiredPermission];
  if (legacy) return legacy;
  if (step.stepName?.trim()) return `Pending ${step.stepName}`;
  return 'Pending Approval';
}

export function userCanApproveStep(user, step) {
  if (!step?.requiredPermission) return false;
  const permissions = getEffectivePermissions(user);
  return permissions.includes(step.requiredPermission) || permissions.includes('view.all');
}

export function getInitialSubmitState(steps, documentType = 'PR') {
  const first = steps[0];
  if (!first) {
    throw new Error('No approval steps configured for this document type');
  }
  return {
    currentApprovalStep: first.stepOrder,
    status: pendingStatusForStep(first, documentType),
  };
}

export function getStateAfterApproval(steps, currentStepOrder, documentType = 'PR') {
  const idx = steps.findIndex((s) => s.stepOrder === currentStepOrder);
  if (idx === -1) {
    throw new Error('Invalid approval step');
  }
  const isFinal = idx === steps.length - 1;
  if (isFinal) {
    const status = documentType === 'PO' ? PO_STATUS.APPROVED : 'Approved';
    return { currentApprovalStep: currentStepOrder, status, isFinal: true };
  }
  const next = steps[idx + 1];
  return {
    currentApprovalStep: next.stepOrder,
    status: pendingStatusForStep(next, documentType),
    isFinal: false,
  };
}
