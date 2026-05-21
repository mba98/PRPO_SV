import odbc from 'odbc';

const HANA_CONNECTION_STRING = process.env.HANA_CONNECTION_STRING;

const ITEM_SEARCH_SQL = `
SELECT ItemCode, ItemName, PurPackMsr, ItmsGrpNam
FROM OITM
WHERE validFor = 'Y'
  AND ( UPPER(ItemCode) LIKE UPPER(?) OR UPPER(ItemName) LIKE UPPER(?) )
LIMIT 20
`;

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
 * Search items in SAP HANA (case-insensitive, precedence-safe).
 */
export async function searchItems(query) {
  const pattern = `%${query}%`;
  return withHanaConnection((connection) =>
    connection.query(ITEM_SEARCH_SQL, [pattern, pattern]),
  );
}

/**
 * Single item detail from HANA.
 */
export async function getItemDetail(itemCode) {
  return withHanaConnection((connection) =>
    connection.query(
      `SELECT ItemCode, ItemName, PurPackMsr, ItmsGrpNam FROM OITM WHERE ItemCode = ? AND validFor = 'Y'`,
      [itemCode],
    ),
  );
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
