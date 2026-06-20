import {
  canApproveCurrentWorkflowStep,
  loadApriWorkflow,
  loadLpWorkflow,
  loadPoWorkflow,
  loadPrWorkflow,
} from '@/lib/workflowSteps.js';

/**
 * Standard approve/reject API payload with workflow state for client updates.
 */
export async function buildApprovalActionResult(
  docType,
  sanitizedDoc,
  user,
  { message, sapResult = null } = {},
) {
  let workflowSteps = [];
  if (docType === 'PR') {
    workflowSteps = await loadPrWorkflow(sanitizedDoc, user);
  } else if (docType === 'PO') {
    workflowSteps = await loadPoWorkflow(sanitizedDoc, user);
  } else if (docType === 'APRI') {
    workflowSteps = await loadApriWorkflow(sanitizedDoc, user);
  } else if (docType === 'LOCAL_PURCHASE') {
    workflowSteps = await loadLpWorkflow(sanitizedDoc, user);
  }

  const currentWorkflowStep = workflowSteps.find((s) => s.state === 'current');
  const document = {
    ...sanitizedDoc,
    workflowSteps,
    canApproveCurrentStep: canApproveCurrentWorkflowStep(workflowSteps),
    canRejectCurrentStep: canApproveCurrentWorkflowStep(workflowSteps),
    currentStepName: currentWorkflowStep?.stepName || null,
    currentStepRequiredPermission: currentWorkflowStep?.requiredPermission || null,
  };

  const payload = {
    document,
    nextStatus: sanitizedDoc.status,
    nextStep: sanitizedDoc.currentApprovalStep,
    message: message || 'Action completed successfully',
    sapResult,
  };

  if (docType === 'PR') payload.pr = document;
  if (docType === 'PO') payload.po = document;
  if (docType === 'APRI') payload.apri = document;
  if (docType === 'LOCAL_PURCHASE') payload.localPurchase = document;

  return payload;
}
