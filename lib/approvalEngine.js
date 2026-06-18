import '@/models/index.js';
import ApprovalMatrix from '@/models/ApprovalMatrix.js';
import { connectDB } from '@/lib/mongodb';
import { cacheDeleteByPrefix, cacheGet, cacheSet } from '@/lib/memoryCache.js';
import { perfAsync } from '@/lib/perfLog.js';
import { getEffectivePermissions } from '@/lib/effectivePermissions.js';
import { PO_STATUS, pendingPoStatusForStep } from '@/lib/poStatus.js';
import { APRI_STATUS, pendingApriStatusForStep } from '@/lib/apriStatus.js';

const APPROVAL_STEPS_CACHE_TTL_MS = 60_000;
const APPROVAL_STEPS_CACHE_PREFIX = 'approval-steps:';

/** Legacy fallback when matrix row has no pendingStatus (PR / older seeds). */
const LEGACY_PERMISSION_STATUS = {
  'pr.approve.whs': 'Pending Warehouse Approval',
  'pr.approve.pm': 'Pending Project Manager Approval',
};

/**
 * Load active approval steps for a document type, ordered by stepOrder.
 * Cached in-process for 60s; invalidated on matrix admin changes.
 */
export async function getApprovalSteps(documentType) {
  const docType = String(documentType || '').trim().toUpperCase();
  const cacheKey = `${APPROVAL_STEPS_CACHE_PREFIX}${docType}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const steps = await perfAsync(`getApprovalSteps ${docType}`, async () => {
    await connectDB();
    return ApprovalMatrix.find({ documentType: docType, isActive: true })
      .sort({ stepOrder: 1 })
      .populate('approverRole', 'name')
      .lean();
  });

  cacheSet(cacheKey, steps, APPROVAL_STEPS_CACHE_TTL_MS);
  return steps;
}

export function invalidateApprovalStepsCache(documentType) {
  if (documentType) {
    cacheDeleteByPrefix(`${APPROVAL_STEPS_CACHE_PREFIX}${String(documentType).trim().toUpperCase()}`);
    return;
  }
  cacheDeleteByPrefix(APPROVAL_STEPS_CACHE_PREFIX);
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
  const docType = String(documentType || 'PR').toUpperCase();
  if (docType === 'PO') {
    return pendingPoStatusForStep(step);
  }
  if (docType === 'APRI') {
    return pendingApriStatusForStep(step);
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
  const docType = String(documentType || 'PR').toUpperCase();
  const first = steps[0];
  if (!first) {
    throw new Error('No approval steps configured for this document type');
  }
  return {
    currentApprovalStep: first.stepOrder,
    status: pendingStatusForStep(first, docType),
  };
}

export function getStateAfterApproval(steps, currentStepOrder, documentType = 'PR') {
  const docType = String(documentType || 'PR').toUpperCase();
  const idx = steps.findIndex((s) => s.stepOrder === currentStepOrder);
  if (idx === -1) {
    throw new Error('Invalid approval step');
  }
  const isFinal = idx === steps.length - 1;
  if (isFinal) {
    if (docType === 'APRI') {
      return {
        currentApprovalStep: 0,
        status: APRI_STATUS.WAREHOUSE_APPROVED,
        isFinal: true,
      };
    }
    const status = docType === 'PO' ? PO_STATUS.APPROVED : 'Approved';
    return { currentApprovalStep: currentStepOrder, status, isFinal: true };
  }
  const next = steps[idx + 1];
  return {
    currentApprovalStep: next.stepOrder,
    status: pendingStatusForStep(next, docType),
    isFinal: false,
  };
}
