import {
  getVendors as slGetVendors,
  getWarehouses as slGetWarehouses,
  getProjects as slGetProjects,
  getCostCenters as slGetCostCenters,
} from '@/lib/sapServiceLayer.js';
import { getLookupCache, setLookupCache } from '@/lib/sapLookupCache.js';

const DEFAULT_LIMIT = 20;

function slRows(payload) {
  if (Array.isArray(payload?.value)) return payload.value;
  if (Array.isArray(payload)) return payload;
  return [];
}

function filterByQuery(rows, query, fields, limit = DEFAULT_LIMIT) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return rows.slice(0, limit);
  return rows
    .filter((row) =>
      fields.some((field) => String(row[field] ?? '').toLowerCase().includes(q)),
    )
    .slice(0, limit);
}

function resolveVendorCurrency(row) {
  const raw =
    row.Currency ||
    row.CardCurrency ||
    row.DocCurrency ||
    row.currency ||
    row.cardCurrency ||
    row.docCurrency;
  if (!raw) return undefined;
  const c = String(raw).trim().toUpperCase();
  if (c === 'IQD' || c === 'USD') return c;
  return String(raw).trim() || undefined;
}

export function mapVendorRow(row) {
  return {
    cardCode: row.CardCode || row.cardCode,
    cardName: row.CardName || row.cardName,
    currency: resolveVendorCurrency(row),
    phone: row.Phone1 || row.phone,
    email: row.E_Mail || row.EmailAddress || row.email,
  };
}

export function mapWarehouseRow(row) {
  const value = row.value ?? row.WarehouseCode ?? row.WhsCode ?? row.warehouseCode;
  const label = row.label ?? row.WarehouseName ?? row.WhsName ?? row.warehouseName;
  return {
    value,
    label,
    code: row.code ?? value,
    warehouseCode: value,
    warehouseName: label,
  };
}

export function mapProjectRow(row) {
  const value = row.Code || row.projectCode;
  const label = row.Name || row.projectName;
  return {
    value,
    label,
    code: value,
    projectCode: value,
    projectName: label,
  };
}

export function mapCostCenterRow(row) {
  return {
    code: row.FactorCode || row.code,
    name: row.FactorDescription || row.name,
    dimension: row.InWhichDimension ?? row.dimension,
  };
}

async function loadCachedList(cacheKey, loader) {
  const cached = getLookupCache(cacheKey);
  if (cached) return cached;
  const raw = await loader();
  const rows = slRows(raw);
  setLookupCache(cacheKey, rows);
  return rows;
}

export async function searchSapVendors(query, limit = DEFAULT_LIMIT) {
  const rows = await loadCachedList('sap:vendors', slGetVendors);
  const mapped = rows.map(mapVendorRow).filter((r) => r.cardCode);
  return filterByQuery(mapped, query, ['cardCode', 'cardName'], limit);
}

export async function searchSapWarehouses(query, limit = DEFAULT_LIMIT) {
  const rows = await loadCachedList('sap:warehouses', slGetWarehouses);
  const mapped = rows.map(mapWarehouseRow).filter((r) => r.warehouseCode);
  return filterByQuery(mapped, query, ['value', 'label', 'code', 'warehouseCode', 'warehouseName'], limit);
}

export async function searchSapProjects(query, limit = DEFAULT_LIMIT) {
  const rows = await loadCachedList('sap:projects', slGetProjects);
  const mapped = rows.map(mapProjectRow).filter((r) => r.projectCode);
  return filterByQuery(mapped, query, ['value', 'label', 'code', 'projectCode', 'projectName'], limit);
}

export async function searchSapCostCenters(query, limit = DEFAULT_LIMIT) {
  const rows = await loadCachedList('sap:cost-centers', slGetCostCenters);
  const mapped = rows.map(mapCostCenterRow).filter((r) => r.code);
  return filterByQuery(mapped, query, ['code', 'name'], limit);
}
