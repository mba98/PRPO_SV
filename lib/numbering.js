/**
 * Atomic portal document number generator.
 * Full usage in document creation phases.
 */

import SystemSettings from '@/models/SystemSettings';
import { connectDB } from '@/lib/mongodb';

function formatDateYmd(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

/**
 * Generate next portal number: PREFIX-YYYYMMDD-0001
 */
export async function nextNumber(prefix, date = new Date()) {
  await connectDB();
  const ymd = formatDateYmd(date);
  const key = `${prefix.toLowerCase()}_seq_${ymd}`;

  const doc = await SystemSettings.findOneAndUpdate(
    { key },
    {
      $inc: { 'value.seq': 1 },
      $setOnInsert: { value: { seq: 0 } },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  const seq = doc.value?.seq ?? 1;
  return `${prefix}-${ymd}-${String(seq).padStart(4, '0')}`;
}
