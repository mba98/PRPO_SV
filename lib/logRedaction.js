const SENSITIVE_KEY = /password|secret|token|cookie|b1session|routeid|authorization|smtp_pass|aws_secret/i;
const INLINE_SECRET =
  /(password|passwd|secret|token|api[_-]?key|b1session|routeid)\s*[=:]\s*['"]?[^\s'"]+/gi;

/**
 * Redact likely secrets from log text shown in admin UI.
 */
export function redactSecretsFromText(text) {
  if (text == null || text === '') return text;
  let out = String(text);
  out = out.replace(INLINE_SECRET, '$1=[redacted]');
  return out;
}

/**
 * Deep-redact object keys/values for admin log viewers.
 */
export function redactSecretsFromObject(value) {
  if (value == null) return value;
  if (typeof value === 'string') return redactSecretsFromText(value);
  if (Array.isArray(value)) return value.map(redactSecretsFromObject);
  if (typeof value !== 'object') return value;

  const out = {};
  for (const [key, val] of Object.entries(value)) {
    if (SENSITIVE_KEY.test(key)) {
      out[key] = '[redacted]';
    } else if (val != null && typeof val === 'object') {
      out[key] = redactSecretsFromObject(val);
    } else if (typeof val === 'string') {
      out[key] = redactSecretsFromText(val);
    } else {
      out[key] = val;
    }
  }
  return out;
}
