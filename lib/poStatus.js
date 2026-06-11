/**
 * Stable internal PO workflow status keys (stored in MongoDB).
 * Use poStatusLabel() / statusLabel() for display text.
 */
export const PO_STATUS = Object.freeze({
  DRAFT: 'draft',
  PENDING_PM: 'pending_pm',
  PENDING_OM: 'pending_om',
  PENDING_FINANCE: 'pending_finance',
  REJECTED: 'rejected',
  APPROVED: 'approved',
  CREATING_IN_SAP: 'creating_in_sap',
  CREATED_IN_SAP: 'created_in_sap',
  FAILED_SAP: 'failed_sap',
  CANCELLED: 'cancelled',
});

export const PO_STATUS_VALUES = Object.values(PO_STATUS);

/** Legacy display strings still present in older records. */
export const PO_LEGACY_STATUS_VALUES = [
  'Draft',
  'Pending Project Manager',
  'Pending Project Manager Approval',
  'Pending Operation Manager',
  'Pending Operation Manager Approval',
  'Pending Finance',
  'Pending Finance Approval',
  'Rejected',
  'Approved',
  'Creating in SAP',
  'Created in SAP',
  'Failed to Create in SAP',
  'Cancelled',
];

export const PO_MODEL_STATUS_ENUM = [...PO_STATUS_VALUES, ...PO_LEGACY_STATUS_VALUES];

export const PO_STATUS_LABELS = Object.freeze({
  [PO_STATUS.DRAFT]: 'Draft',
  [PO_STATUS.PENDING_PM]: 'Pending Project Manager',
  [PO_STATUS.PENDING_OM]: 'Pending Operation Manager',
  [PO_STATUS.PENDING_FINANCE]: 'Pending Finance',
  [PO_STATUS.REJECTED]: 'Rejected',
  [PO_STATUS.APPROVED]: 'Approved',
  [PO_STATUS.CREATING_IN_SAP]: 'Creating in SAP',
  [PO_STATUS.CREATED_IN_SAP]: 'Created in SAP',
  [PO_STATUS.FAILED_SAP]: 'Failed SAP',
  [PO_STATUS.CANCELLED]: 'Cancelled',
});

const LEGACY_TO_PO_STATUS = Object.freeze({
  Draft: PO_STATUS.DRAFT,
  draft: PO_STATUS.DRAFT,
  'Pending Project Manager': PO_STATUS.PENDING_PM,
  'Pending Project Manager Approval': PO_STATUS.PENDING_PM,
  pending_pm: PO_STATUS.PENDING_PM,
  'Pending Operation Manager': PO_STATUS.PENDING_OM,
  'Pending Operation Manager Approval': PO_STATUS.PENDING_OM,
  pending_om: PO_STATUS.PENDING_OM,
  'Pending Finance': PO_STATUS.PENDING_FINANCE,
  'Pending Finance Approval': PO_STATUS.PENDING_FINANCE,
  pending_finance: PO_STATUS.PENDING_FINANCE,
  Rejected: PO_STATUS.REJECTED,
  rejected: PO_STATUS.REJECTED,
  Approved: PO_STATUS.APPROVED,
  approved: PO_STATUS.APPROVED,
  'Creating in SAP': PO_STATUS.CREATING_IN_SAP,
  creating_in_sap: PO_STATUS.CREATING_IN_SAP,
  'Created in SAP': PO_STATUS.CREATED_IN_SAP,
  created_in_sap: PO_STATUS.CREATED_IN_SAP,
  'Failed to Create in SAP': PO_STATUS.FAILED_SAP,
  'Failed SAP': PO_STATUS.FAILED_SAP,
  failed_sap: PO_STATUS.FAILED_SAP,
  Cancelled: PO_STATUS.CANCELLED,
  cancelled: PO_STATUS.CANCELLED,
});

export const PO_PERMISSION_STATUS = Object.freeze({
  'po.approve.pm': PO_STATUS.PENDING_PM,
  'po.approve.om': PO_STATUS.PENDING_OM,
  'po.approve.finance': PO_STATUS.PENDING_FINANCE,
});

const PO_STEP_NAME_PATTERNS = [
  [/project\s*manager/i, PO_STATUS.PENDING_PM],
  [/operation\s*manager/i, PO_STATUS.PENDING_OM],
  [/finance/i, PO_STATUS.PENDING_FINANCE],
];

export function normalizePoStatus(status) {
  if (status == null || status === '') return status;
  const key = String(status).trim();
  return LEGACY_TO_PO_STATUS[key] || LEGACY_TO_PO_STATUS[key.toLowerCase()] || key;
}

export function poStatusesEqual(a, b) {
  return normalizePoStatus(a) === normalizePoStatus(b);
}

/** All DB values that represent the same logical PO status (for Mongo queries). */
export function poStatusVariants(status) {
  const norm = normalizePoStatus(status);
  const variants = new Set([norm]);
  for (const [legacy, stable] of Object.entries(LEGACY_TO_PO_STATUS)) {
    if (stable === norm) variants.add(legacy);
  }
  return [...variants];
}

export function poStatusInQuery(...statuses) {
  const all = new Set();
  for (const s of statuses) {
    for (const v of poStatusVariants(s)) all.add(v);
  }
  return { $in: [...all] };
}

export function poStatusLabel(status) {
  const norm = normalizePoStatus(status);
  return PO_STATUS_LABELS[norm] || String(status || '');
}

export function isPendingPoApprovalStatus(status) {
  const norm = normalizePoStatus(status);
  return [PO_STATUS.PENDING_PM, PO_STATUS.PENDING_OM, PO_STATUS.PENDING_FINANCE].includes(norm);
}

export function isPoApprovedOrSapStatus(status) {
  const norm = normalizePoStatus(status);
  return [
    PO_STATUS.APPROVED,
    PO_STATUS.CREATING_IN_SAP,
    PO_STATUS.CREATED_IN_SAP,
    PO_STATUS.FAILED_SAP,
  ].includes(norm);
}

export function isPoEditableStatus(status) {
  const norm = normalizePoStatus(status);
  return [
    PO_STATUS.DRAFT,
    PO_STATUS.REJECTED,
    PO_STATUS.PENDING_PM,
    PO_STATUS.PENDING_OM,
    PO_STATUS.PENDING_FINANCE,
    PO_STATUS.APPROVED,
    PO_STATUS.FAILED_SAP,
  ].includes(norm);
}

export function isPoNonEditableStatus(status) {
  const norm = normalizePoStatus(status);
  return [PO_STATUS.CREATING_IN_SAP, PO_STATUS.CREATED_IN_SAP].includes(norm);
}

/**
 * Resolve PO status for an approval matrix step (stable key).
 */
export function pendingPoStatusForStep(step) {
  if (!step) return null;

  if (step.pendingStatus?.trim()) {
    return normalizePoStatus(step.pendingStatus.trim());
  }

  if (PO_PERMISSION_STATUS[step.requiredPermission]) {
    return PO_PERMISSION_STATUS[step.requiredPermission];
  }

  const name = step.stepName || '';
  for (const [pattern, status] of PO_STEP_NAME_PATTERNS) {
    if (pattern.test(name)) return status;
  }

  return PO_STATUS.PENDING_PM;
}
