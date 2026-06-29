import { getItemDetail } from '@/lib/sapHana.js';
import { resolveLineUomCode } from '@/lib/sap/uomCode.js';

function uomMismatchError(itemCode, submitted, authoritative) {
  const err = new Error(
    `Unit of measure for item ${itemCode} cannot be changed. Expected ${authoritative}, received ${submitted}.`,
  );
  err.code = 'UOM_IMMUTABLE';
  return err;
}

function readItemUomFromDetail(rows) {
  const row = rows?.[0];
  if (!row) return null;
  const code =
    row.uomCode ?? row.UOMCODE ?? row.UgpCode ?? row.ugpCode ?? row.purchaseUom ?? row.buyUnitMsr;
  const name = row.uom ?? row.UOM ?? row.UgpName ?? row.ugpName ?? code;
  const trimmed = String(code ?? '').trim();
  if (!trimmed) return null;
  return { uomCode: trimmed, uom: String(name ?? trimmed).trim() || trimmed };
}

export async function fetchAuthoritativeUomForItemCode(itemCode) {
  const code = String(itemCode || '').trim();
  if (!code) return null;
  const rows = await getItemDetail(code);
  return readItemUomFromDetail(rows);
}

export function resolveStoredLineUom(line) {
  return resolveLineUomCode(line) || undefined;
}

/**
 * Enforce SAP item-master UoM on a PR line.
 * @throws Error code UOM_IMMUTABLE when client attempts to change UoM
 */
export async function enforcePrLineUom(line, existingLine = null) {
  const itemCode = String(line?.itemCode || '').trim();
  if (!itemCode) return line;

  const submitted = resolveStoredLineUom(line);
  const existingCode = existingLine ? resolveStoredLineUom(existingLine) : null;

  if (existingLine && existingLine.itemCode === itemCode && existingCode) {
    if (submitted && submitted !== existingCode) {
      throw uomMismatchError(itemCode, submitted, existingCode);
    }
    return {
      ...line,
      uomCode: existingCode,
      uom: existingLine.uom || existingLine.ugpName || existingCode,
      ugpName: existingLine.ugpName || existingLine.uom || existingCode,
    };
  }

  const authoritative = await fetchAuthoritativeUomForItemCode(itemCode);
  if (!authoritative?.uomCode) {
    if (submitted) return { ...line, uomCode: submitted, uom: line.uom || submitted };
    return line;
  }

  if (submitted && submitted !== authoritative.uomCode) {
    throw uomMismatchError(itemCode, submitted, authoritative.uomCode);
  }

  return {
    ...line,
    uomCode: authoritative.uomCode,
    uom: authoritative.uom,
    ugpName: authoritative.uom,
  };
}

/**
 * Enforce UoM on PO lines — from PR source line or SAP item master.
 */
export async function enforcePoLineUom(line, { existingLine = null, prLine = null } = {}) {
  const itemCode = String(line?.itemCode || '').trim();
  if (!itemCode) return line;

  const submitted = resolveStoredLineUom(line);

  if (prLine) {
    const prUom = resolveStoredLineUom(prLine);
    if (prUom) {
      if (submitted && submitted !== prUom) {
        throw uomMismatchError(itemCode, submitted, prUom);
      }
      return {
        ...line,
        uomCode: prUom,
        uom: prLine.uom || prUom,
      };
    }
  }

  return enforcePrLineUom(line, existingLine);
}

export async function enforcePrLinesUom(lines = [], existingLines = []) {
  const byId = new Map(
    (existingLines || []).map((l) => [l._id?.toString?.() || l.id, l]),
  );
  const normalized = [];
  for (const line of lines) {
    const existing = line._id ? byId.get(String(line._id)) : null;
    normalized.push(await enforcePrLineUom(line, existing));
  }
  return normalized;
}

export async function enforcePoLinesUom(lines = [], existingLines = [], prLinesById = new Map()) {
  const byId = new Map(
    (existingLines || []).map((l) => [l._id?.toString?.() || l.id, l]),
  );
  const normalized = [];
  for (const line of lines) {
    const existing = line._id ? byId.get(String(line._id)) : null;
    const prLine = line.relatedPRLineId
      ? prLinesById.get(String(line.relatedPRLineId))
      : null;
    normalized.push(await enforcePoLineUom(line, { existingLine: existing, prLine }));
  }
  return normalized;
}
