import { isInvalidSapOptionalCode } from '@/lib/sap/mappers/prToSap.js';

/**
 * Resolve SAP UoMCode from line (uomCode preferred, uom fallback).
 */
export function resolveLineUomCode(line) {
  const code = String(line?.uomCode ?? '').trim();
  if (code && !isInvalidSapOptionalCode(code)) return code;
  const fallback = String(line?.uom ?? '').trim();
  if (fallback && !isInvalidSapOptionalCode(fallback)) return fallback;
  return null;
}
