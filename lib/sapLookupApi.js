import { jsonError } from '@/lib/apiHelpers';

export function logSapLookupError(scope, err) {
  const detail = err?.message || String(err);
  console.error(`[${scope}]`, detail);
}

export function sapLookupFailureResponse(scope, err, userMessage) {
  logSapLookupError(scope, err);
  if (err?.message?.includes('HANA_CONNECTION_STRING') || err?.message?.includes('not configured')) {
    return jsonError(userMessage, 'HANA_UNAVAILABLE', 503);
  }
  if (err?.message?.includes('SAP_SL_')) {
    return jsonError(userMessage, 'SAP_SL_UNAVAILABLE', 503);
  }
  return jsonError(userMessage, 'SAP_LOOKUP_FAILED', 503);
}
