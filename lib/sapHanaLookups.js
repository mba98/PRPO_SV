import {
  listAccounts,
  listCompanyValues,
  listItemGroups,
  listUomGroups,
  listWarehouses,
} from '@/lib/sapHana.js';

function pickField(row, ...keys) {
  for (const key of keys) {
    if (row[key] != null && row[key] !== '') return row[key];
    const upper = key.toUpperCase();
    if (row[upper] != null && row[upper] !== '') return row[upper];
  }
  return undefined;
}

/** Standard SAP lookup row: { value, label, code }. */
export function mapValueLabelRow(row, { valueKeys = [], labelKeys = [], codeKeys = [] } = {}) {
  const rawValue = pickField(row, 'value', 'VALUE', ...valueKeys);
  const rawLabel = pickField(row, 'label', 'LABEL', ...labelKeys);
  const rawCode = pickField(row, 'code', 'CODE', ...codeKeys);
  const value = rawValue != null && rawValue !== '' ? rawValue : undefined;
  const label = rawLabel != null ? String(rawLabel) : undefined;
  const code = rawCode != null ? String(rawCode) : undefined;
  return {
    value: value != null ? (typeof value === 'number' ? value : String(value)) : undefined,
    label,
    code: code ?? (value != null ? String(value) : undefined),
  };
}

/** Maps OUGP row to { value: UgpEntry, label: UgpName, code: UgpCode } for OITM.UgpEntry. */
export function mapUomGroupRow(row) {
  const mapped = mapValueLabelRow(row, {
    valueKeys: ['UgpEntry'],
    labelKeys: ['UgpName'],
    codeKeys: ['UgpCode'],
  });
  if (mapped.value != null && mapped.value !== '') {
    mapped.value = Number(mapped.value);
  }
  return mapped;
}

export function mapItemGroupRow(row) {
  const mapped = mapValueLabelRow(row, {
    valueKeys: ['ItmsGrpCod'],
    labelKeys: ['ItmsGrpNam'],
    codeKeys: ['ItmsGrpCod'],
  });
  if (mapped.value != null && mapped.value !== '') {
    mapped.value = Number(mapped.value);
  }
  return mapped;
}

export function mapAccountRow(row) {
  return mapValueLabelRow(row, {
    valueKeys: ['code', 'AcctCode'],
    labelKeys: ['name', 'AcctName'],
    codeKeys: ['code', 'AcctCode'],
  });
}

export function mapCompanyRow(row) {
  return mapValueLabelRow(row, {
    valueKeys: ['code', 'FldValue'],
    labelKeys: ['name', 'Descr'],
    codeKeys: ['code', 'FldValue'],
  });
}

export function mapWarehouseRow(row) {
  return mapValueLabelRow(row, {
    valueKeys: ['WhsCode', 'WarehouseCode'],
    labelKeys: ['WhsName', 'WarehouseName'],
    codeKeys: ['WhsCode', 'WarehouseCode'],
  });
}

function filterRows(rows, query, fields) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((row) =>
    fields.some((field) => String(row[field] ?? '').toLowerCase().includes(q)),
  );
}

export async function searchSapUomGroups(query, limit = 100) {
  const rows = await listUomGroups(limit);
  const mapped = (rows || []).map(mapUomGroupRow).filter((r) => r.value != null);
  return filterRows(mapped, query, ['label', 'code', 'value']).slice(0, limit);
}

export async function searchSapItemGroups(query, limit = 100) {
  const rows = await listItemGroups(limit);
  const mapped = (rows || []).map(mapItemGroupRow).filter((r) => r.value != null);
  return filterRows(mapped, query, ['label', 'code', 'value']).slice(0, limit);
}

function isValidLookupResult(row) {
  const value = String(row?.value ?? '').trim();
  return Boolean(value) && value !== '..';
}

function normalizeLookupResult(row) {
  return {
    ...row,
    value: String(row.value).trim(),
    code: String(row.code ?? row.value).trim(),
    label: String(row.label ?? '').trim(),
  };
}

export async function searchSapAccounts(query, limit = 20) {
  const rows = await listAccounts(query, limit);
  return (rows || []).map(mapAccountRow).filter(isValidLookupResult).map(normalizeLookupResult);
}

export async function searchSapCompanies(query, limit = 20) {
  const rows = await listCompanyValues(query, limit);
  return (rows || []).map(mapCompanyRow).filter(isValidLookupResult).map(normalizeLookupResult);
}

export async function searchSapWarehousesHana(query, limit = 100) {
  const rows = await listWarehouses(limit);
  const mapped = (rows || []).map(mapWarehouseRow).filter((r) => r.value);
  return filterRows(mapped, query, ['label', 'code', 'value']).slice(0, limit);
}
