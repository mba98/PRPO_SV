/**
 * Optional default PO exchange rate from env (not required).
 */
export function resolveDefaultPoDocRate() {
  const raw = process.env.DEFAULT_PO_DOC_RATE?.trim();
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}
