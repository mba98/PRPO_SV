import {
  getApprovalSteps,
  pendingStatusForStep,
} from '@/lib/approvalEngine.js';
import { canUserApproveDocument } from '@/lib/documentApprovalAuth.js';
import {
  PO_STATUS,
  isPoApprovedOrSapStatus,
  normalizePoStatus,
  poStatusesEqual,
} from '@/lib/poStatus.js';

import {
  APRI_STATUS,
  apriStatusesEqual,
  isApriCreatedInSap,
  isApriFailedSap,
  isApriReadyForSapCreation,
  isApriReturnedToProcurement,
  isApriSapInProgress,
  isPendingApriWarehouseStatus,
  normalizeApriStatus,
} from '@/lib/apriStatus.js';
import {
  LP_STATUS,
  lpStatusesEqual,
} from '@/lib/localPurchaseStatus.js';

const SAP_STEP_NAME = 'SAP Created';

function isDraftStatus(doc, documentType) {
  if (documentType === 'PO') return poStatusesEqual(doc.status, PO_STATUS.DRAFT);
  if (documentType === 'LOCAL_PURCHASE') return lpStatusesEqual(doc.status, LP_STATUS.DRAFT);
  return doc.status === 'Draft';
}

function isRejectedStatus(doc, documentType) {
  if (documentType === 'PO') return poStatusesEqual(doc.status, PO_STATUS.REJECTED);
  if (documentType === 'APRI') {
    return apriStatusesEqual(doc.status, APRI_STATUS.WAREHOUSE_REJECTED);
  }
  if (documentType === 'LOCAL_PURCHASE') return lpStatusesEqual(doc.status, LP_STATUS.REJECTED);
  return doc.status === 'Rejected';
}

function statusMatches(docStatus, expected, documentType) {
  if (documentType === 'PO') return poStatusesEqual(docStatus, expected);
  if (documentType === 'APRI') return apriStatusesEqual(docStatus, expected);
  if (documentType === 'LOCAL_PURCHASE') return lpStatusesEqual(docStatus, expected);
  return docStatus === expected;
}

function isApprovedOrSapComplete(doc, documentType) {
  if (documentType === 'PO') return isPoApprovedOrSapStatus(doc.status);
  if (documentType === 'LOCAL_PURCHASE') return lpStatusesEqual(doc.status, LP_STATUS.COMPLETED);
  if (documentType === 'APRI') {
    return (
      isApriReturnedToProcurement(doc.status) ||
      isApriSapInProgress(doc.status) ||
      isApriCreatedInSap(doc.status) ||
      isApriFailedSap(doc.status)
    );
  }
  return doc.status === 'Approved' || doc.status?.includes('SAP') || doc.status === 'Creating in SAP';
}

/**
 * Build PR/PO approval + SAP workflow steps from approval_matrix (dynamic).
 */
export function buildApprovalWorkflowSteps(steps, doc, documentType, user) {
  const rejected = isRejectedStatus(doc, documentType);
  const draft = isDraftStatus(doc, documentType);
  const currentOrder = doc.currentApprovalStep || 0;

  return steps.map((step) => {
    const pendingStatus = pendingStatusForStep(step, documentType);
    let state = 'pending';
    let canApprove = false;

    if (documentType === 'LOCAL_PURCHASE' && lpStatusesEqual(doc.status, LP_STATUS.COMPLETED)) {
      return {
        kind: 'approval',
        stepOrder: step.stepOrder,
        stepName: step.stepName || `Step ${step.stepOrder}`,
        requiredPermission: step.requiredPermission,
        completionPolicy: step.completionPolicy || 'ANY_ONE',
        state: 'completed',
        canApprove: false,
      };
    }

    if (rejected) {
      if (documentType === 'APRI' && step.stepOrder === 1) {
        state = 'rejected';
      } else if (currentOrder === step.stepOrder) {
        state = 'rejected';
      }
    } else if (documentType === 'APRI' && step.stepOrder === 1 && isApriReturnedToProcurement(doc.status)) {
      state = 'completed';
    } else if (draft || currentOrder < step.stepOrder) {
      state = 'pending';
    } else if (currentOrder === step.stepOrder && statusMatches(doc.status, pendingStatus, documentType)) {
      state = 'current';
      canApprove = canUserApproveDocument({
        documentType,
        document: doc,
        user,
        approvalSteps: steps,
        step,
        logDiagnostics: false,
      });
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
      completionPolicy: step.completionPolicy || 'ANY_ONE',
      state,
      canApprove,
    };
  });
}

export function buildCreatedWorkflowStep(doc, documentType = 'PO') {
  let state = 'completed';
  if (
    (documentType === 'LOCAL_PURCHASE' && lpStatusesEqual(doc.status, LP_STATUS.DRAFT)) ||
    poStatusesEqual(doc.status, PO_STATUS.DRAFT) ||
    doc.status === 'Draft'
  ) {
    state = doc.currentApprovalStep === 0 ? 'current' : 'pending';
  } else if (
    (documentType === 'LOCAL_PURCHASE' && lpStatusesEqual(doc.status, LP_STATUS.REJECTED)) ||
    ((poStatusesEqual(doc.status, PO_STATUS.REJECTED) || doc.status === 'Rejected') &&
      !doc.currentApprovalStep)
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
  } else if (documentType === 'APRI') {
    const norm = normalizeApriStatus(doc.status);
    if ([APRI_STATUS.DRAFT, APRI_STATUS.PENDING_WAREHOUSE].includes(norm)) {
      state = 'pending';
    } else if (isApriSapInProgress(doc.status)) {
      state = 'sap_creating';
    } else if (isApriFailedSap(doc.status)) {
      state = 'sap_failed';
    } else if (sapDocEntry || isApriCreatedInSap(doc.status)) {
      state = 'sap_created';
    } else if (isApriReturnedToProcurement(doc.status)) {
      state = 'pending';
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

export function buildReturnedToProcurementStep(apri, stepOrder) {
  let state = 'pending';
  const norm = normalizeApriStatus(apri.status);
  if ([APRI_STATUS.WAREHOUSE_APPROVED, APRI_STATUS.WAREHOUSE_REJECTED].includes(norm)) {
    state = 'current';
  } else if (
    isApriSapInProgress(apri.status) ||
    isApriCreatedInSap(apri.status) ||
    isApriFailedSap(apri.status)
  ) {
    state = 'completed';
  }
  return {
    kind: 'procurement',
    stepOrder,
    stepName: 'Returned to Procurement',
    state,
    canApprove: false,
  };
}

export async function loadApriWorkflow(apri, user, steps = null) {
  const matrixSteps = steps || (await getApprovalSteps('APRI'));
  const created = buildCreatedWorkflowStep(apri);
  const approvalSteps = buildApprovalWorkflowSteps(matrixSteps, apri, 'APRI', user);
  const returnedStep = buildReturnedToProcurementStep(apri, matrixSteps.length + 1);
  const sapStep = buildSapWorkflowStep(apri, matrixSteps.length + 2, 'APRI');
  return [created, ...approvalSteps, returnedStep, sapStep];
}

export function buildLpCompletedStep(doc, stepOrder) {
  let state = 'pending';
  if (lpStatusesEqual(doc.status, LP_STATUS.COMPLETED)) {
    state = 'completed';
  } else if (lpStatusesEqual(doc.status, LP_STATUS.CANCELLED)) {
    state = 'rejected';
  }
  return {
    kind: 'completed',
    stepOrder,
    stepName: 'Completed Locally',
    state,
    canApprove: false,
  };
}

export async function loadLpWorkflow(doc, user, steps = null) {
  const matrixSteps = steps || (await getApprovalSteps('LOCAL_PURCHASE'));
  const created = buildCreatedWorkflowStep(doc, 'LOCAL_PURCHASE');
  const approvalSteps = buildApprovalWorkflowSteps(matrixSteps, doc, 'LOCAL_PURCHASE', user);
  const completedStep = buildLpCompletedStep(doc, matrixSteps.length + 1);
  return [created, ...approvalSteps, completedStep];
}

export function canApproveCurrentWorkflowStep(workflowSteps) {
  return workflowSteps.some((s) => s.state === 'current' && s.canApprove);
}
