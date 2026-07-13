/**
 * Stable internal APRI workflow status keys (stored in MongoDB).
 * Use apriStatusLabel() for display text.
 */
export const APRI_STATUS = Object.freeze({
  DRAFT: 'draft',
  PENDING_WAREHOUSE: 'pending_warehouse',
  WAREHOUSE_APPROVED: 'warehouse_approved',
  WAREHOUSE_REJECTED: 'warehouse_rejected',
  CREATING_IN_SAP: 'creating_in_sap',
  CREATED_IN_SAP: 'created_in_sap',
  FAILED_SAP: 'failed_sap',
  CANCELLED: 'cancelled',
});

export const APRI_STATUS_VALUES = Object.values(APRI_STATUS);

export const APRI_LEGACY_STATUS_VALUES = [
  'Ready for AP Reserve Invoice',
  'Pending Warehouse Approval',
  'Rejected',
  'Approved',
  'Creating in SAP',
  'Created in SAP',
  'Failed to Create in SAP',
  'Completed',
];

export const APRI_MODEL_STATUS_ENUM = [...APRI_STATUS_VALUES, ...APRI_LEGACY_STATUS_VALUES];

export const APRI_STATUS_LABELS = Object.freeze({
  [APRI_STATUS.DRAFT]: 'Draft',
  [APRI_STATUS.PENDING_WAREHOUSE]: 'Pending Warehouse Approval',
  [APRI_STATUS.WAREHOUSE_APPROVED]: 'Warehouse Approved',
  [APRI_STATUS.WAREHOUSE_REJECTED]: 'Warehouse Rejected',
  [APRI_STATUS.CREATING_IN_SAP]: 'Creating in SAP',
  [APRI_STATUS.CREATED_IN_SAP]: 'Created in SAP',
  [APRI_STATUS.FAILED_SAP]: 'Failed to Create in SAP',
  [APRI_STATUS.CANCELLED]: 'Cancelled',
});

const LEGACY_TO_APRI_STATUS = Object.freeze({
  draft: APRI_STATUS.DRAFT,
  Draft: APRI_STATUS.DRAFT,
  'Ready for AP Reserve Invoice': APRI_STATUS.DRAFT,
  pending_warehouse: APRI_STATUS.PENDING_WAREHOUSE,
  'Pending Warehouse Approval': APRI_STATUS.PENDING_WAREHOUSE,
  warehouse_approved: APRI_STATUS.WAREHOUSE_APPROVED,
  Approved: APRI_STATUS.WAREHOUSE_APPROVED,
  warehouse_rejected: APRI_STATUS.WAREHOUSE_REJECTED,
  Rejected: APRI_STATUS.WAREHOUSE_REJECTED,
  creating_in_sap: APRI_STATUS.CREATING_IN_SAP,
  'Creating in SAP': APRI_STATUS.CREATING_IN_SAP,
  created_in_sap: APRI_STATUS.CREATED_IN_SAP,
  'Created in SAP': APRI_STATUS.CREATED_IN_SAP,
  failed_sap: APRI_STATUS.FAILED_SAP,
  'Failed to Create in SAP': APRI_STATUS.FAILED_SAP,
  Completed: APRI_STATUS.CREATED_IN_SAP,
  cancelled: APRI_STATUS.CANCELLED,
  Cancelled: APRI_STATUS.CANCELLED,
});

export const APRI_PERMISSION_STATUS = Object.freeze({
  'apri.approve.whs': APRI_STATUS.PENDING_WAREHOUSE,
  /** Legacy matrix rows before migrate:apri-matrix-whs-permission */
  'pr.approve.whs': APRI_STATUS.PENDING_WAREHOUSE,
});

export function normalizeApriStatus(status) {
  if (status == null || status === '') return status;
  const key = String(status).trim();
  return LEGACY_TO_APRI_STATUS[key] || LEGACY_TO_APRI_STATUS[key.toLowerCase()] || key;
}

export function apriStatusesEqual(a, b) {
  return normalizeApriStatus(a) === normalizeApriStatus(b);
}

export function apriStatusVariants(status) {
  const norm = normalizeApriStatus(status);
  const variants = new Set([norm]);
  for (const [legacy, stable] of Object.entries(LEGACY_TO_APRI_STATUS)) {
    if (stable === norm) variants.add(legacy);
  }
  return [...variants];
}

export function apriStatusInQuery(...statuses) {
  const all = new Set();
  for (const s of statuses) {
    for (const v of apriStatusVariants(s)) all.add(v);
  }
  return { $in: [...all] };
}

export function apriStatusLabel(status) {
  const norm = normalizeApriStatus(status);
  return APRI_STATUS_LABELS[norm] || String(status || '');
}

export function isPendingApriWarehouseStatus(status) {
  return normalizeApriStatus(status) === APRI_STATUS.PENDING_WAREHOUSE;
}

export function isApriReadyForSapCreation(status) {
  const norm = normalizeApriStatus(status);
  return norm === APRI_STATUS.WAREHOUSE_APPROVED;
}

export function isApriSapInProgress(status) {
  return normalizeApriStatus(status) === APRI_STATUS.CREATING_IN_SAP;
}

export function isApriCreatedInSap(status) {
  return normalizeApriStatus(status) === APRI_STATUS.CREATED_IN_SAP;
}

export function isApriFailedSap(status) {
  return normalizeApriStatus(status) === APRI_STATUS.FAILED_SAP;
}

export function isApriReadOnly(status) {
  const norm = normalizeApriStatus(status);
  return [APRI_STATUS.CREATING_IN_SAP, APRI_STATUS.CREATED_IN_SAP].includes(norm);
}

export function isApriReturnedToProcurement(status) {
  const norm = normalizeApriStatus(status);
  return [APRI_STATUS.WAREHOUSE_APPROVED, APRI_STATUS.WAREHOUSE_REJECTED].includes(norm);
}

export function pendingApriStatusForStep(step) {
  if (!step) return null;
  if (APRI_PERMISSION_STATUS[step.requiredPermission]) {
    return APRI_PERMISSION_STATUS[step.requiredPermission];
  }
  if (step.pendingStatus?.trim()) {
    const normalized = normalizeApriStatus(step.pendingStatus.trim());
    if (APRI_STATUS_VALUES.includes(normalized)) return normalized;
  }
  if (/warehouse/i.test(step.stepName || '')) {
    return APRI_STATUS.PENDING_WAREHOUSE;
  }
  return APRI_STATUS.PENDING_WAREHOUSE;
}
