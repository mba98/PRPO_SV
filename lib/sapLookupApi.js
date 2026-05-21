import { jsonError } from '@/lib/apiHelpers';

export function logSapLookupError(scope, err) {
  // Real, technical error is logged server-side only (never returned to client).
  const detail = err?.message || String(err);
  const status = err?.status ? ` (status ${err.status})` : '';
  console.error(`[${scope}]${status}`, detail);
}

export function sapLookupFailureResponse(scope, err, userMessage) {
  logSapLookupError(scope, err);

  // Connection / authentication problems with the Service Layer.
  if (err?.code === 'SAP_LOGIN_FAILED' || /login (failed|transport)/i.test(err?.message || '')) {
    return jsonError('Failed to connect to SAP Service Layer', 'SAP_LOGIN_FAILED', 503);
  }
  if (err?.message?.includes('HANA_CONNECTION_STRING') || err?.message?.includes('not configured')) {
    return jsonError(userMessage, 'HANA_UNAVAILABLE', 503);
  }
  if (err?.message?.includes('SAP_SL_')) {
    return jsonError(userMessage, 'SAP_SL_UNAVAILABLE', 503);
  }
  // Authenticated, but the lookup itself failed.
  return jsonError(userMessage, 'SAP_LOOKUP_FAILED', 503);
}
