/**
 * Parse numeric form/API values; preserves zero (unlike `Number(v) || fallback`).
 */
export function parseNumberAllowZero(value, fallback = 0) {
  if (value === '' || value === null || value === undefined) return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
