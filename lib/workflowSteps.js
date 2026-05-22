import {
  getApprovalSteps,
  pendingStatusForStep,
  userCanApproveStep,
} from '@/lib/approvalEngine.js';
import { getEffectivePermissions } from '@/lib/effectivePermissions.js';

const SAP_STEP_NAME = 'SAP Created';

/**
 * Build PR/PO approval + SAP workflow steps from approval_matrix (dynamic).
 */
export function buildApprovalWorkflowSteps(steps, doc, documentType, user) {
  const permissions = getEffectivePermissions(user);
  const rejected = doc.status === 'Rejected';
  const draft = doc.status === 'Draft';
  const currentOrder = doc.currentApprovalStep || 0;

  return steps.map((step) => {
    const pendingStatus = pendingStatusForStep(step, documentType);
    let state = 'pending';
    let canApprove = false;

    if (rejected && currentOrder === step.stepOrder) {
      state = 'rejected';
    } else if (draft || currentOrder < step.stepOrder) {
      state = 'pending';
    } else if (currentOrder === step.stepOrder && doc.status === pendingStatus) {
      state = 'current';
      canApprove = userCanApproveStep({ permissions }, step);
    } else if (currentOrder > step.stepOrder) {
      state = 'completed';
    } else if (doc.status === 'Approved' || doc.status?.includes('SAP') || doc.status === 'Creating in SAP') {
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

export function buildSapWorkflowStep(doc, approvalStepCount) {
  let state = 'pending';

  if (doc.status === 'Draft' || doc.status === 'Rejected') {
    state = 'pending';
  } else if (doc.status === 'Creating in SAP') {
    state = 'sap_creating';
  } else if (doc.status === 'Failed to Create in SAP') {
    state = 'sap_failed';
  } else if (doc.sapPRDocEntry || doc.status === 'Created in SAP') {
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

export function buildDocumentWorkflow(steps, doc, documentType, user) {
  const approvalSteps = buildApprovalWorkflowSteps(steps, doc, documentType, user);
  const sapStep = buildSapWorkflowStep(doc, steps.length);
  return [...approvalSteps, sapStep];
}

export async function loadPrWorkflow(pr, user) {
  const steps = await getApprovalSteps('PR');
  return buildDocumentWorkflow(steps, pr, 'PR', user);
}

export function canApproveCurrentWorkflowStep(workflowSteps) {
  return workflowSteps.some((s) => s.state === 'current' && s.canApprove);
}
