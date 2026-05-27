import '@/models/index.js';
import SapIntegrationLog from '@/models/SapIntegrationLog.js';
import { connectDB } from '@/lib/mongodb';
import { sanitizeSapErrorText } from '@/lib/sap/sapErrors.js';

const SENSITIVE_KEYS = /password|cookie|b1session|routeid|authorization/i;

function redactValue(key, value) {
  if (SENSITIVE_KEYS.test(String(key))) return '[redacted]';
  return value;
}

/**
 * Shallow-clone payloads for persistence without secrets.
 */
export function sanitizeLogPayload(payload) {
  if (payload == null) return null;
  if (typeof payload !== 'object') return payload;
  if (Array.isArray(payload)) {
    return payload.map((item) => sanitizeLogPayload(item));
  }
  const out = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value != null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      out[key] = sanitizeLogPayload(value);
    } else if (typeof value === 'string') {
      out[key] = redactValue(key, sanitizeSapErrorText(value));
    } else {
      out[key] = redactValue(key, value);
    }
  }
  return out;
}

/**
 * Write a standardized SAP integration log row.
 */
export async function writeSapIntegrationLog({
  documentType,
  documentId,
  action,
  requestPayload,
  responsePayload,
  sapDocEntry,
  sapDocNum,
  status,
  errorMessage,
}) {
  await connectDB();
  return SapIntegrationLog.create({
    documentType,
    documentId,
    action,
    requestPayload: sanitizeLogPayload(requestPayload),
    responsePayload: sanitizeLogPayload(responsePayload),
    sapDocEntry,
    sapDocNum: sapDocNum != null ? String(sapDocNum) : undefined,
    status,
    errorMessage: errorMessage ? sanitizeSapErrorText(errorMessage) : undefined,
  });
}

export async function logSapDuplicateGuard({
  documentType,
  documentId,
  action,
  sapDocEntry,
  sapDocNum,
  message,
}) {
  return writeSapIntegrationLog({
    documentType,
    documentId,
    action: action || 'DUPLICATE_GUARD',
    requestPayload: null,
    responsePayload: { skipped: true, reason: message },
    sapDocEntry,
    sapDocNum,
    status: 'Failed',
    errorMessage: message,
  });
}
