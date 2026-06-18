import { PO_STATUS } from '@/lib/poStatus.js';
import { logApprovalHistory } from '@/lib/auditHistory.js';
import { normalizeCompletionPolicy } from '@/lib/approvalPolicies.js';

export const APPROVAL_STEP_ALREADY_COMPLETED = 'APPROVAL_STEP_ALREADY_COMPLETED';

export function createApprovalStepConflictError() {
  const err = new Error('This approval step has already been completed by another approver.');
  err.code = APPROVAL_STEP_ALREADY_COMPLETED;
  return err;
}

export function assertApprovalVersionProvided(__v) {
  if (__v == null) {
    const err = new Error('Document version is required');
    err.code = 'VERSION_CONFLICT';
    throw err;
  }
}

export function assertApprovalVersionMatches(document, __v) {
  assertApprovalVersionProvided(__v);
  if (__v !== document.__v) {
    const err = new Error('Document changed');
    err.code = 'VERSION_CONFLICT';
    throw err;
  }
}

/**
 * Build a conditional filter for atomic approve/reject on the current approval step.
 */
export function buildAtomicStepFilter(document, __v) {
  return {
    _id: document._id,
    status: document.status,
    currentApprovalStep: document.currentApprovalStep,
    __v,
  };
}

/**
 * Atomically transition a document when the current step is still pending.
 * Returns the updated document or throws APPROVAL_STEP_ALREADY_COMPLETED.
 */
export async function atomicDocumentStepTransition(Model, filter, setFields) {
  const updated = await Model.findOneAndUpdate(
    filter,
    {
      $set: setFields,
      $inc: { __v: 1 },
    },
    { new: true },
  );

  if (!updated) {
    throw createApprovalStepConflictError();
  }

  return updated;
}

export function rejectedStatusForDocumentType(documentType) {
  const docType = String(documentType || 'PR').toUpperCase();
  if (docType === 'PO') return PO_STATUS.REJECTED;
  return 'Rejected';
}

export async function logStepApprovalHistory({
  documentType,
  documentId,
  step,
  action,
  user,
  comment,
  previousStatus,
  newStatus,
}) {
  return logApprovalHistory({
    documentType,
    documentId,
    stepName: step.stepName,
    stepOrder: step.stepOrder,
    completionPolicy: normalizeCompletionPolicy(step.completionPolicy),
    requiredPermission: step.requiredPermission,
    action,
    actionBy: user,
    actionByRole: user.roleName,
    comment,
    previousStatus,
    newStatus,
  });
}
