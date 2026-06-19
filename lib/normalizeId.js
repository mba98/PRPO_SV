/**
 * Normalize MongoDB ObjectId, populated refs, and string IDs for comparison.
 */
export function normalizeId(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'object') {
    if (value._id != null) return String(value._id);
    if (value.id != null) return String(value.id);
  }
  return String(value);
}
