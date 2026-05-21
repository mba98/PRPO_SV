import odbc from 'odbc';
import {
  buildItemDetailSql,
  buildItemSearchSql,
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
export async function pingHana() {
  return withHanaConnection(async (connection) => {
    const result = await connection.query('SELECT 1 FROM DUMMY');
    return Array.isArray(result) && result.length >= 0;
  });
}
