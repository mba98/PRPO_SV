import {
  listAccounts,
  listCompanyValues,
  listItemGroups,
  listUomGroups,
} from '@/lib/sapHana.js';

function pickField(row, ...keys) {
  for (const key of keys) {
    if (row[key] != null && row[key] !== '') return row[key];
    const upper = key.toUpperCase();
    if (row[upper] != null && row[upper] !== '') return row[upper];
  }
  return undefined;
}

export function mapUomGroupRow(row) {
  const ugpEntry = pickField(row, 'UgpEntry');
  return {
    ugpEntry: ugpEntry != null ? Number(ugpEntry) : undefined,
    ugpCode: pickField(row, 'UgpCode'),
    ugpName: pickField(row, 'UgpName'),
  };
}

export function mapItemGroupRow(row) {
  const code = pickField(row, 'ItmsGrpCod');
  return {
    itmsGrpCod: code != null ? Number(code) : undefined,
    itmsGrpNam: pickField(row, 'ItmsGrpNam'),
  };
}

export function mapAccountRow(row) {
  return {
    acctCode: pickField(row, 'AcctCode'),
    acctName: pickField(row, 'AcctName'),
  };
}

export function mapCompanyRow(row) {
  return {
    company: pickField(row, 'Company', 'U_Company'),
  };
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
  const mapped = (rows || []).map(mapUomGroupRow).filter((r) => r.ugpEntry != null);
  return filterRows(mapped, query, ['ugpCode', 'ugpName']).slice(0, limit);
}

export async function searchSapItemGroups(query, limit = 100) {
  const rows = await listItemGroups(limit);
  const mapped = (rows || []).map(mapItemGroupRow).filter((r) => r.itmsGrpCod != null);
  return filterRows(mapped, query, ['itmsGrpNam']).slice(0, limit);
}

export async function searchSapAccounts(query, limit = 100) {
  const rows = await listAccounts(limit);
  const mapped = (rows || []).map(mapAccountRow).filter((r) => r.acctCode);
  return filterRows(mapped, query, ['acctCode', 'acctName']).slice(0, limit);
}

export async function searchSapCompanies(query, limit = 100) {
  const rows = await listCompanyValues(limit);
  const mapped = (rows || []).map(mapCompanyRow).filter((r) => r.company);
  return filterRows(mapped, query, ['company']).slice(0, limit);
}
