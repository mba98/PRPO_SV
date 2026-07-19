import odbc from 'odbc';
import {
  buildAccountsSql,
  buildCompanyValidValuesSql,
  buildCompanyUsedValuesSql,
  buildCompanyLocalCurrencySql,
  buildCompanyCurrenciesSql,
  buildItemDetailSql,
  buildItemGroupsSql,
  buildItemSearchSql,
  buildUomGroupsSql,
  buildVendorCrd13CurrencySql,
  buildVendorHeaderCurrencySql,
  buildVendorSearchSql,
  buildVendorSearchCountSql,
  buildVendorCurrencySql,
  buildExchangeRateSql,
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

function normalizeItemLookupArgs(query, limit) {
  const q = String(query || '').trim();
  return {
    pattern: q ? `%${q}%` : '%',
    limit: Math.min(Math.max(1, Number(limit) || 20), 50),
  };
}

export async function listAccounts(query = '', limit = 20) {
  const schema = getHanaCompanySchema();
  const lookup = normalizeItemLookupArgs(query, limit);
  const sql = buildAccountsSql(schema);
  return withHanaConnection((connection) =>
    connection.query(sql, [lookup.pattern, lookup.pattern, lookup.limit]),
  );
}

/**
 * Company lookup sources for OITM.U_Company:
 * - validValues: UFD1 valid values (may be empty when the UDF has none defined)
 * - usedValues: distinct values actually stored in OITM.U_Company
 */
export async function listCompanyValues(query = '', limit = 20) {
  const schema = getHanaCompanySchema();
  const lookup = normalizeItemLookupArgs(query, limit);
  const validValuesSql = buildCompanyValidValuesSql(schema);
  const usedValuesSql = buildCompanyUsedValuesSql(schema);
  return withHanaConnection(async (connection) => {
    const validValues = await connection.query(validValuesSql, [
      lookup.pattern,
      lookup.pattern,
      lookup.limit,
    ]);
    const usedValues = await connection.query(usedValuesSql, [lookup.pattern, lookup.limit]);
    return { validValues, usedValues };
  });
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

export async function getCompanyCurrencies() {
  const schema = getHanaCompanySchema();
  const sql = buildCompanyCurrenciesSql(schema);
  const rows = await withHanaConnection((connection) => connection.query(sql));
  const row = rows?.[0];
  const local = readHanaField(row, 'localCurrency', 'MainCurncy', 'MAINCURNCY');
  const system = readHanaField(row, 'systemCurrency', 'SysCurrncy', 'SYSCURRNCY');
  return {
    localCurrency: local ? String(local).trim().toUpperCase() : null,
    systemCurrency: system ? String(system).trim().toUpperCase() : null,
  };
}

export async function getCompanyLocalCurrency() {
  const { localCurrency } = await getCompanyCurrencies();
  return localCurrency;
}

/**
 * Exchange rate from SAP HANA ORTT for an exact currency + document date.
 */
export async function getExchangeRateFromHana(currency, date) {
  const schema = getHanaCompanySchema();
  const sql = buildExchangeRateSql(schema);
  const rows = await withHanaConnection((connection) =>
    connection.query(sql, [currency, date]),
  );
  const row = rows?.[0];
  const rate = readHanaField(row, 'rate', 'Rate', 'RATE');
  if (rate == null || rate === '') return null;
  const n = Number(rate);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
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
