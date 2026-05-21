import '@/models/index.js';
import ApprovalMatrix from '@/models/ApprovalMatrix.js';
import { connectDB } from '@/lib/mongodb';

const PR_PERMISSION_STATUS = {
  'pr.approve.whs': 'Pending Warehouse Approval',
  'pr.approve.pm': 'Pending Project Manager Approval',
};

/**
 * Load active approval steps for a document type, ordered by stepOrder.
 */
export async function getApprovalSteps(documentType) {
  await connectDB();
  return ApprovalMatrix.find({ documentType, isActive: true })
    .sort({ stepOrder: 1 })
    .populate('approverRole', 'name')
    .lean();
}

export function getCurrentStep(steps, currentApprovalStep) {
  if (!steps?.length || !currentApprovalStep) return null;
  return steps.find((s) => s.stepOrder === currentApprovalStep) || null;
}

export function pendingStatusForPermission(requiredPermission) {
  return PR_PERMISSION_STATUS[requiredPermission] || 'Pending Approval';
}

export function pendingStatusForStep(step) {
  if (!step) return null;
  return pendingStatusForPermission(step.requiredPermission);
}

export function userCanApproveStep(user, step) {
  if (!step?.requiredPermission || !user?.permissions) return false;
  return user.permissions.includes(step.requiredPermission) || user.permissions.includes('view.all');
}

export function getInitialSubmitState(steps) {
  const first = steps[0];
  if (!first) {
    throw new Error('No approval steps configured for this document type');
  }
  return {
    currentApprovalStep: first.stepOrder,
    status: pendingStatusForStep(first),
  };
}

export function getStateAfterApproval(steps, currentStepOrder) {
  const idx = steps.findIndex((s) => s.stepOrder === currentStepOrder);
  if (idx === -1) {
    throw new Error('Invalid approval step');
  }
  const isFinal = idx === steps.length - 1;
  if (isFinal) {
    return { currentApprovalStep: currentStepOrder, status: 'Approved', isFinal: true };
  }
  const next = steps[idx + 1];
  return {
    currentApprovalStep: next.stepOrder,
    status: pendingStatusForStep(next),
    isFinal: false,
  };
}
