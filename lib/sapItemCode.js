import { getLastItemCodeFromHana } from '@/lib/sapHana.js';
import { getItem } from '@/lib/sapServiceLayer.js';

const MAX_ALLOCATION_ATTEMPTS = 10;

export function getItemCodePrefix() {
  return (process.env.SAP_ITEM_CODE_PREFIX || '125').trim();
}

export function getItemCodeStart(prefix = getItemCodePrefix()) {
  const configured = process.env.SAP_ITEM_CODE_START?.trim();
  if (configured) return configured;
  return `${prefix}0000001`;
}

export function buildItemCodePattern(prefix) {
  const escaped = String(prefix).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped}\\d+$`);
}

/**
 * Compute the next item code from the last known code (pure, testable).
 */
export function computeNextItemCode(lastCode, options = {}) {
  const prefix = options.prefix ?? getItemCodePrefix();
  const startCode = options.startCode ?? getItemCodeStart(prefix);
  const pattern = buildItemCodePattern(prefix);

  if (lastCode && pattern.test(String(lastCode).trim())) {
    return String(BigInt(String(lastCode).trim()) + 1n);
  }

  if (!pattern.test(startCode)) {
    throw new Error(`SAP_ITEM_CODE_START "${startCode}" does not match prefix pattern "${prefix}"`);
  }

  return startCode;
}

async function itemCodeExistsInSap(itemCode) {
  try {
    await getItem(itemCode);
    return true;
  } catch (err) {
    if (err.status === 404) return false;
    throw err;
  }
}

/**
 * Read last matching code from HANA, increment, and verify uniqueness in SAP.
 */
export async function getNextItemCode() {
  const prefix = getItemCodePrefix();
  const startCode = getItemCodeStart(prefix);
  const lastCode = await getLastItemCodeFromHana(prefix);
  let candidate = computeNextItemCode(lastCode, { prefix, startCode });

  for (let attempt = 0; attempt < MAX_ALLOCATION_ATTEMPTS; attempt += 1) {
    if (!(await itemCodeExistsInSap(candidate))) {
      return candidate;
    }
    candidate = computeNextItemCode(candidate, { prefix, startCode: candidate });
  }

  const err = new Error('Could not allocate a unique SAP item code');
  err.code = 'ITEM_CODE_ALLOCATION_FAILED';
  throw err;
}
