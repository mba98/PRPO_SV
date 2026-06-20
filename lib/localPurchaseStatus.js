/**
 * Stable internal Local Purchase workflow status keys (stored in MongoDB).
 */
export const LP_STATUS = Object.freeze({
  DRAFT: 'draft',
  PENDING_PM: 'pending_pm',
  PENDING_FINANCE: 'pending_finance',
  REJECTED: 'rejected',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
});

export const LP_STATUS_VALUES = Object.values(LP_STATUS);

export const LP_STATUS_LABELS_EN = Object.freeze({
  [LP_STATUS.DRAFT]: 'Draft',
  [LP_STATUS.PENDING_PM]: 'Pending Project Manager Approval',
  [LP_STATUS.PENDING_FINANCE]: 'Pending Finance Approval',
  [LP_STATUS.REJECTED]: 'Rejected',
  [LP_STATUS.COMPLETED]: 'Completed',
  [LP_STATUS.CANCELLED]: 'Cancelled',
});

export const LP_STATUS_LABELS_AR = Object.freeze({
  [LP_STATUS.DRAFT]: 'مسودة',
  [LP_STATUS.PENDING_PM]: 'بانتظار موافقة مدير المشروع',
  [LP_STATUS.PENDING_FINANCE]: 'بانتظار موافقة الحسابات',
  [LP_STATUS.REJECTED]: 'مرفوض',
  [LP_STATUS.COMPLETED]: 'مكتمل',
  [LP_STATUS.CANCELLED]: 'ملغي',
});

export const LP_MODEL_STATUS_ENUM = [...LP_STATUS_VALUES];

export const LP_PERMISSION_STATUS = Object.freeze({
  'lp.approve.pm': LP_STATUS.PENDING_PM,
  'lp.approve.finance': LP_STATUS.PENDING_FINANCE,
});

const LP_STEP_NAME_PATTERNS = [
  [/project\s*manager/i, LP_STATUS.PENDING_PM],
  [/finance/i, LP_STATUS.PENDING_FINANCE],
];

export function normalizeLpStatus(status) {
  if (status == null || status === '') return status;
  const key = String(status).trim();
  if (LP_STATUS_VALUES.includes(key)) return key;
  return key;
}

/** Alias used by UI layers — canonical stored status key. */
export const normalizeLocalPurchaseStatus = normalizeLpStatus;

/**
 * Normalize terminal LP states so list/detail/workflow use the same step pointer.
 */
export function normalizeLpDocumentState(doc) {
  if (!doc) return doc;
  const status = normalizeLpStatus(doc.status);
  const normalized = { ...doc, status };
  if (
    lpStatusesEqual(status, LP_STATUS.COMPLETED) ||
    lpStatusesEqual(status, LP_STATUS.CANCELLED) ||
    lpStatusesEqual(status, LP_STATUS.REJECTED) ||
    lpStatusesEqual(status, LP_STATUS.DRAFT)
  ) {
    normalized.currentApprovalStep = 0;
  }
  return normalized;
}

export function lpStatusesEqual(a, b) {
  return normalizeLpStatus(a) === normalizeLpStatus(b);
}

export function lpStatusInQuery(...statuses) {
  const all = new Set();
  for (const s of statuses) {
    all.add(normalizeLpStatus(s));
  }
  return { $in: [...all] };
}

export function lpStatusLabel(status, locale = 'en') {
  const norm = normalizeLpStatus(status);
  const labels = locale === 'ar' ? LP_STATUS_LABELS_AR : LP_STATUS_LABELS_EN;
  return labels[norm] || String(status || '');
}

export function isPendingLpApprovalStatus(status) {
  const norm = normalizeLpStatus(status);
  return [LP_STATUS.PENDING_PM, LP_STATUS.PENDING_FINANCE].includes(norm);
}

export function isLpEditableStatus(status) {
  const norm = normalizeLpStatus(status);
  return [LP_STATUS.DRAFT, LP_STATUS.REJECTED].includes(norm);
}

export function isLpReadOnlyStatus(status) {
  const norm = normalizeLpStatus(status);
  return [LP_STATUS.COMPLETED, LP_STATUS.CANCELLED].includes(norm);
}

export function isValidLpStatusKey(status) {
  return LP_STATUS_VALUES.includes(normalizeLpStatus(status));
}

export function pendingLpStatusForStep(step) {
  if (!step) return null;

  if (LP_PERMISSION_STATUS[step.requiredPermission]) {
    return LP_PERMISSION_STATUS[step.requiredPermission];
  }

  const name = step.stepName || '';
  for (const [pattern, status] of LP_STEP_NAME_PATTERNS) {
    if (pattern.test(name)) return status;
  }

  if (step.pendingStatus?.trim()) {
    const normalized = normalizeLpStatus(step.pendingStatus.trim());
    if (isValidLpStatusKey(normalized)) {
      return normalized;
    }
  }

  return LP_STATUS.PENDING_PM;
}
