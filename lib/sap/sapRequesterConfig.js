/**
 * SAP B1 employee / user code for Purchase Request "Requester".
 * Confirmed working Postman value: "manager".
 * Override via SAP_REQUESTER_CODE_REQUESTER or DEFAULT_SAP_REQUESTER_CODE in .env.local.
 */
export const DEV_DEFAULT_SAP_REQUESTER_CODE = 'manager';

/**
 * Default SAP requester code for PR creation (local/dev fallback only).
 */
export function resolveDefaultSapRequesterCode() {
  const fromRequester = process.env.SAP_REQUESTER_CODE_REQUESTER?.trim();
  if (fromRequester) return fromRequester;

  const fromDefault = process.env.DEFAULT_SAP_REQUESTER_CODE?.trim();
  if (fromDefault) return fromDefault;

  if (process.env.NODE_ENV !== 'production') {
    return DEV_DEFAULT_SAP_REQUESTER_CODE;
  }

  return null;
}
