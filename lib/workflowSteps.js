import {
  getApprovalSteps,
  pendingStatusForStep,
  userCanApproveStep,
} from '@/lib/approvalEngine.js';
import { getEffectivePermissions } from '@/lib/effectivePermissions.js';
import {
  PO_STATUS,
  isPoApprovedOrSapStatus,
  normalizePoStatus,
  poStatusesEqual,
} from '@/lib/poStatus.js';

const SAP_STEP_NAME = 'SAP Created';

function isDraftStatus(doc, documentType) {
  if (documentType === 'PO') return poStatusesEqual(doc.status, PO_STATUS.DRAFT);
  return doc.status === 'Draft';
}

function isRejectedStatus(doc, documentType) {
  if (documentType === 'PO') return poStatusesEqual(doc.status, PO_STATUS.REJECTED);
  return doc.status === 'Rejected';
}

function statusMatches(docStatus, expected, documentType) {
  if (documentType === 'PO') return poStatusesEqual(docStatus, expected);
  return docStatus === expected;
}

function isApprovedOrSapComplete(doc, documentType) {
  if (documentType === 'PO') return isPoApprovedOrSapStatus(doc.status);
  return doc.status === 'Approved' || doc.status?.includes('SAP') || doc.status === 'Creating in SAP';
}

/**
 * Build PR/PO approval + SAP workflow steps from approval_matrix (dynamic).
 */
export function buildApprovalWorkflowSteps(steps, doc, documentType, user) {
  const permissions = getEffectivePermissions(user);
  const rejected = isRejectedStatus(doc, documentType);
  const draft = isDraftStatus(doc, documentType);
  const currentOrder = doc.currentApprovalStep || 0;

  return steps.map((step) => {
    const pendingStatus = pendingStatusForStep(step, documentType);
    let state = 'pending';
    let canApprove = false;

    if (rejected && currentOrder === step.stepOrder) {
      state = 'rejected';
    } else if (draft || currentOrder < step.stepOrder) {
      state = 'pending';
    } else if (currentOrder === step.stepOrder && statusMatches(doc.status, pendingStatus, documentType)) {
      state = 'current';
      canApprove = userCanApproveStep({ permissions }, step);
    } else if (currentOrder > step.stepOrder) {
      state = 'completed';
    } else if (isApprovedOrSapComplete(doc, documentType)) {
      state = 'completed';
    }

    return {
      kind: 'approval',
      stepOrder: step.stepOrder,
      stepName: step.stepName || `Step ${step.stepOrder}`,
      requiredPermission: step.requiredPermission,
      state,
      canApprove,
    };
  });
}

export function buildCreatedWorkflowStep(doc) {
  let state = 'completed';
  if (poStatusesEqual(doc.status, PO_STATUS.DRAFT) || doc.status === 'Draft') {
    state = doc.currentApprovalStep === 0 ? 'current' : 'pending';
  } else if (
    (poStatusesEqual(doc.status, PO_STATUS.REJECTED) || doc.status === 'Rejected') &&
    !doc.currentApprovalStep
  ) {
    state = 'rejected';
  }
  return {
    kind: 'created',
    stepOrder: 0,
    stepName: 'Created',
    state,
    canApprove: false,
  };
}

function resolveSapDocEntry(doc, documentType) {
  if (documentType === 'PO') return doc.sapPODocEntry;
  if (documentType === 'APRI') return doc.sapAPDocEntry;
  return doc.sapPRDocEntry;
}

export function buildSapWorkflowStep(doc, approvalStepCount, documentType = 'PR') {
  let state = 'pending';
  const sapDocEntry = resolveSapDocEntry(doc, documentType);

  if (documentType === 'PO') {
    const norm = normalizePoStatus(doc.status);
    if ([PO_STATUS.DRAFT, PO_STATUS.REJECTED].includes(norm)) {
      state = 'pending';
    } else if (norm === PO_STATUS.CREATING_IN_SAP) {
      state = 'sap_creating';
    } else if (norm === PO_STATUS.FAILED_SAP) {
      state = 'sap_failed';
    } else if (sapDocEntry || norm === PO_STATUS.CREATED_IN_SAP) {
      state = 'sap_created';
    } else if (norm === PO_STATUS.APPROVED) {
      state = 'current';
    }
  } else if (doc.status === 'Draft' || doc.status === 'Rejected') {
    state = 'pending';
  } else if (doc.status === 'Creating in SAP') {
    state = 'sap_creating';
  } else if (doc.status === 'Failed to Create in SAP') {
    state = 'sap_failed';
  } else if (sapDocEntry || doc.status === 'Created in SAP') {
    state = 'sap_created';
  } else if (doc.status === 'Approved') {
    state = 'current';
  }

  return {
    kind: 'sap',
    stepOrder: approvalStepCount + 1,
    stepName: SAP_STEP_NAME,
    state,
    canApprove: false,
  };
}

export function buildDocumentWorkflow(steps, doc, documentType, user, { includeCreated = false } = {}) {
  const approvalSteps = buildApprovalWorkflowSteps(steps, doc, documentType, user);
  const sapStep = buildSapWorkflowStep(doc, steps.length, documentType);
  if (includeCreated) {
    return [buildCreatedWorkflowStep(doc), ...approvalSteps, sapStep];
  }
  return [...approvalSteps, sapStep];
}

export async function loadPrWorkflow(pr, user) {
  const steps = await getApprovalSteps('PR');
  return buildDocumentWorkflow(steps, pr, 'PR', user);
}

export async function loadPoWorkflow(po, user) {
  const steps = await getApprovalSteps('PO');
  return buildDocumentWorkflow(steps, po, 'PO', user, { includeCreated: true });
}

export async function loadApriWorkflow(apri, user, steps = null) {
  const matrixSteps = steps || (await getApprovalSteps('APRI'));
  return buildDocumentWorkflow(matrixSteps, apri, 'APRI', user, { includeCreated: true });
}

export function canApproveCurrentWorkflowStep(workflowSteps) {
  return workflowSteps.some((s) => s.state === 'current' && s.canApprove);
}
