export function normalizeQuantity(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function buildLineQtyMap(lines) {
  const next = {};
  for (const line of lines || []) {
    if (!line._id) continue;
    const qty = normalizeQuantity(line.quantity);
    if (qty != null) next[line._id] = qty;
  }
  return next;
}

export function lineQtyMapsEqual(current, saved) {
  const ids = new Set([...Object.keys(current || {}), ...Object.keys(saved || {})]);
  for (const id of ids) {
    if (normalizeQuantity(current?.[id]) !== normalizeQuantity(saved?.[id])) {
      return false;
    }
  }
  return true;
}
