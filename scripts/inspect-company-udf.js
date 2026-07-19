import odbc from 'odbc';

const schema = process.env.HANA_SCHEMA || process.env.SAP_SL_COMPANY_DB;
if (!schema || !process.env.HANA_CONNECTION_STRING) {
  throw new Error('HANA configuration is missing');
}

const s = `"${schema.replaceAll('"', '""')}"`;

const metadataSql = `
SELECT
  "TableID",
  "FieldID",
  "AliasID",
  "Descr"
FROM ${s}."CUFD"
WHERE "TableID" = 'OITM'
  AND UPPER("AliasID") LIKE '%COMPANY%'
`.trim();

const validValuesSql = `
SELECT
  T0."AliasID",
  T1."FldValue",
  T1."Descr"
FROM ${s}."CUFD" T0
INNER JOIN ${s}."UFD1" T1
  ON T1."TableID" = T0."TableID"
 AND T1."FieldID" = T0."FieldID"
WHERE T0."TableID" = 'OITM'
  AND UPPER(T0."AliasID") = 'COMPANY'
`.trim();

const usedValuesSql = `
SELECT DISTINCT
  TRIM(T0."U_Company") AS "code"
FROM ${s}."OITM" T0
WHERE TRIM(COALESCE(T0."U_Company", '')) <> ''
ORDER BY "code"
`.trim();

const connection = await odbc.connect(process.env.HANA_CONNECTION_STRING);
try {
  const metadata = await connection.query(metadataSql);
  console.log('--- CUFD metadata (OITM %COMPANY%) ---');
  console.log(JSON.stringify(metadata, null, 2));

  const validValues = await connection.query(validValuesSql);
  console.log('--- UFD1 valid values (OITM Company) ---');
  console.log(JSON.stringify(validValues, null, 2));

  const usedValues = await connection.query(usedValuesSql);
  console.log('--- Distinct OITM.U_Company values ---');
  console.log(JSON.stringify(usedValues, null, 2));
} finally {
  await connection.close();
}
