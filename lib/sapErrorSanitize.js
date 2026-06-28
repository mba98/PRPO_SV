/**
 * Sanitize SAP error text for user-facing email — no credentials or session tokens.
 */
export function sanitizeSapErrorForEmail(message) {
  if (!message) return 'SAP request failed';
  let sanitized = String(message);
  sanitized = sanitized.replace(/B1SESSION[=:][^\s;]*/gi, 'B1SESSION=[redacted]');
  sanitized = sanitized.replace(/RouteId[=:][^\s;]*/gi, 'RouteId=[redacted]');
  sanitized = sanitized.replace(/mongodb(\+srv)?:\/\/[^\s]+/gi, '[database connection redacted]');
  if (sanitized.length > 500) {
    sanitized = `${sanitized.slice(0, 497)}...`;
  }
  return sanitized;
}
