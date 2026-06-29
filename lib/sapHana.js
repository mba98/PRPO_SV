import odbc from 'odbc';
import {
  buildAccountsSql,
  buildCompanyValuesSql,
  buildCompanyLocalCurrencySql,
  buildItemDetailSql,
  buildItemGroupsSql,
  buildItemSearchSql,
  buildUomGroupsSql,
  buildVendorCrd13CurrencySql,
  buildVendorHeaderCurrencySql,
  buildVendorSearchSql,
  buildVendorSearchCountSql,
  buildVendorCurrencySql,
  buildWarehousesSql,
  getHanaCompanySchema,
  resolveLimitStyle,
} from '@/lib/sap/hanaSql.js';

const HANA_CONNECTION_STRING = process.env.HANA_CONNECTION_STRING;

/**
 * Open ODBC connection, run callback, always close in finally.
 */
export async function withHanaConnection(fn) {
  if (!HANA_CONNECTION_STRING) {
    throw new Error('HANA_CONNECTION_STRING is not configured');
  }

  let connection;
  try {
    connection = await odbc.connect(HANA_CONNECTION_STRING);
    return await fn(connection);
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch {
        // Connection close errors are logged at call site; do not throw.
      }
    }
  }
}

/**
 * Search items in SAP HANA (OITM + OITB join, parameterized LIKE).
 */
export async function searchItems(query, limit = 20) {
  const schema = getHanaCompanySchema();
  const pattern = `%${query}%`;
  const sql = buildItemSearchSql(schema, limit, resolveLimitStyle());
  return withHanaConnection((connection) => connection.query(sql, [pattern, pattern]));
}

/**
 * Single item detail from HANA.
 */
export async function getItemDetail(itemCode) {
  const schema = getHanaCompanySchema();
  const sql = buildItemDetailSql(schema);
  return withHanaConnection((connection) => connection.query(sql, [itemCode]));
}

/**
 * Health probe: run a minimal query.
 */
export async function listUomGroups(limit = 100) {
  const schema = getHanaCompanySchema();
  const sql = buildUomGroupsSql(schema, limit, resolveLimitStyle());
  return withHanaConnection((connection) => connection.query(sql));
}

export async function listItemGroups(limit = 100) {
  const schema = getHanaCompanySchema();
  const sql = buildItemGroupsSql(schema, limit, resolveLimitStyle());
  return withHanaConnection((connection) => connection.query(sql));
}

export async function listAccounts(limit = 100) {
  const schema = getHanaCompanySchema();
  const sql = buildAccountsSql(schema, limit, resolveLimitStyle());
  return withHanaConnection((connection) => connection.query(sql));
}

export async function listCompanyValues(limit = 100) {
  const schema = getHanaCompanySchema();
  const sql = buildCompanyValuesSql(schema, limit, resolveLimitStyle());
  return withHanaConnection((connection) => connection.query(sql));
}

export async function listWarehouses(limit = 100) {
  const schema = getHanaCompanySchema();
  const sql = buildWarehousesSql(schema, limit, resolveLimitStyle());
  return withHanaConnection((connection) => connection.query(sql));
}

export async function listVendorCrd13CurrencyRows(vendorCode) {
  const schema = getHanaCompanySchema();
  const sql = buildVendorCrd13CurrencySql(schema);
  return withHanaConnection((connection) => connection.query(sql, [vendorCode]));
}

export async function getVendorHeaderFromHana(vendorCode) {
  const schema = getHanaCompanySchema();
  const sql = buildVendorHeaderCurrencySql(schema);
  const rows = await withHanaConnection((connection) => connection.query(sql, [vendorCode]));
  return rows?.[0] || null;
}

/** @deprecated Use listVendorCrd13CurrencyRows. */
export async function listVendorCurrencyRows(vendorCode) {
  return listVendorCrd13CurrencyRows(vendorCode);
}

export async function getCompanyLocalCurrency() {
  const schema = getHanaCompanySchema();
  const sql = buildCompanyLocalCurrencySql(schema);
  const rows = await withHanaConnection((connection) => connection.query(sql));
  const row = rows?.[0];
  const value = row?.MainCurncy ?? row?.MAINCURNCY ?? row?.maincurncy;
  return value ? String(value).trim().toUpperCase() : null;
}

function readHanaField(row, ...keys) {
  if (!row) return undefined;
  for (const key of keys) {
    if (row[key] != null && row[key] !== '') return row[key];
    const found = Object.keys(row).find((k) => k.toLowerCase() === key.toLowerCase());
    if (found && row[found] != null && row[found] !== '') return row[found];
  }
  return undefined;
}

/**
 * Search active suppliers in OCRD via HANA ODBC (parameterized).
 */
export async function searchVendors(query, { limit = 20, page = 1 } = {}) {
  const schema = getHanaCompanySchema();
  const q = String(query || '').trim();
  const pattern = q ? `%${q}%` : '%';
  const safeLimit = Math.min(Math.max(1, Number(limit) || 20), 100);
  const safePage = Math.max(1, Number(page) || 1);
  const offset = (safePage - 1) * safeLimit;
  const params = [pattern, pattern, pattern];
  const sql = buildVendorSearchSql(schema, safeLimit, offset, resolveLimitStyle());
  const countSql = buildVendorSearchCountSql(schema);

  return withHanaConnection(async (connection) => {
    const [rows, countRows] = await Promise.all([
      connection.query(sql, params),
      connection.query(countSql, params),
    ]);
    const total = Number(readHanaField(countRows?.[0], 'total', 'TOTAL')) || 0;
    const items = (rows || []).map((row) => ({
      vendorCode: readHanaField(row, 'vendorCode', 'VENDORCODE', 'CardCode'),
      vendorName: readHanaField(row, 'vendorName', 'VENDORNAME', 'CardName'),
      foreignName: readHanaField(row, 'foreignName', 'FOREIGNNAME', 'CardFName'),
      currency: readHanaField(row, 'currency', 'CURRENCY', 'Currency'),
    }));
    return {
      items,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: safeLimit > 0 ? Math.ceil(total / safeLimit) : 0,
      },
    };
  });
}

export async function pingHana() {
  return withHanaConnection(async (connection) => {
    const result = await connection.query('SELECT 1 FROM DUMMY');
    return Array.isArray(result) && result.length >= 0;
  });
}
