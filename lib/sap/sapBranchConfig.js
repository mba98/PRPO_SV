/**
 * SAP B1 branch (BPL_IDAssignedToInvoice) defaults for Purchase Requests.
 * Override via system_settings.branch_map or SAP_DEFAULT_BRANCH_ID in .env.local.
 */
export const DEV_DEFAULT_BRANCH_ID = -2;

/**
 * Resolve SAP branch id from department → branch_map (and optional default key).
 * Returns null in production when unmapped (no silent Branch=1 fallback).
 */
export function resolveBranchId(department, branchMap = {}) {
  if (department && branchMap[department] != null) {
    return Number(branchMap[department]);
  }
  if (branchMap.default != null) {
    return Number(branchMap.default);
  }

  const envDefault = process.env.SAP_DEFAULT_BRANCH_ID?.trim();
  if (envDefault) {
    return parseInt(envDefault, 10);
  }

  if (process.env.NODE_ENV !== 'production') {
    return DEV_DEFAULT_BRANCH_ID;
  }

  return null;
}
