import '@/models/index.js';
import ApprovalMatrix from '@/models/ApprovalMatrix.js';
import { connectDB } from '@/lib/mongodb';

const PERMISSION_STATUS_BY_DOC = {
  PR: {
    'pr.approve.whs': 'Pending Warehouse Approval',
    'pr.approve.pm': 'Pending Project Manager Approval',
  },
  PO: {
    'po.approve.pm': 'Pending Project Manager Approval',
    'po.approve.finance': 'Pending Finance Approval',
  },
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

export function pendingStatusForPermission(requiredPermission, documentType = 'PR') {
  const map = PERMISSION_STATUS_BY_DOC[documentType] || {};
  return map[requiredPermission] || 'Pending Approval';
}

export function pendingStatusForStep(step, documentType = 'PR') {
  if (!step) return null;
  return pendingStatusForPermission(step.requiredPermission, documentType);
}

export function userCanApproveStep(user, step) {
  if (!step?.requiredPermission || !user?.permissions) return false;
  return user.permissions.includes(step.requiredPermission) || user.permissions.includes('view.all');
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
    return { currentApprovalStep: currentStepOrder, status: 'Approved', isFinal: true };
  }
  const next = steps[idx + 1];
  return {
    currentApprovalStep: next.stepOrder,
    status: pendingStatusForStep(next, documentType),
    isFinal: false,
  };
}
