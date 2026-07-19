/**
 * SAP HANA SQL builders (quoted identifiers, company schema).
 */

export function getHanaCompanySchema() {
  const schema = process.env.HANA_SCHEMA || process.env.SAP_SL_COMPANY_DB;
  if (!schema?.trim()) {
    throw new Error('SAP_SL_COMPANY_DB or HANA_SCHEMA is not configured');
  }
  return schema.trim();
}

export function quoteIdentifier(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

export function quoteSchema(schema) {
  return quoteIdentifier(schema);
}

/**
 * @param {'limit' | 'fetch'} style
 */
export function buildLimitClause(limit = 20, style = 'limit') {
  const n = Math.min(Math.max(1, Number(limit) || 20), 100);
  if (style === 'fetch') {
    return `FETCH FIRST ${n} ROWS ONLY`;
  }
  return `LIMIT ${n}`;
}

export function resolveLimitStyle() {
  const env = (process.env.HANA_SQL_LIMIT_STYLE || 'limit').toLowerCase();
  return env === 'fetch' ? 'fetch' : 'limit';
}

export function buildItemSearchSql(schema, limit = 20, limitStyle = resolveLimitStyle()) {
  const s = quoteSchema(schema);
  const limitClause = buildLimitClause(limit, limitStyle);
  return `
SELECT
  T0."ItemCode" AS "itemCode",
  T0."ItemName" AS "itemName",
  T0."PurPackMsr" AS "purchaseUom",
  T0."BuyUnitMsr" AS "buyUnitMsr",
  T0."InvntryUom" AS "inventoryUom",
  T0."DfltWH" AS "warehouseCode",
  T2."WhsName" AS "warehouseName",
  T0."UgpEntry" AS "ugpEntry",
  T0."ItmsGrpCod" AS "itemGroupCode",
  T1."ItmsGrpNam" AS "itemGroupName"
FROM ${s}."OITM" T0
LEFT JOIN ${s}."OITB" T1
  ON T0."ItmsGrpCod" = T1."ItmsGrpCod"
LEFT JOIN ${s}."OWHS" T2
  ON T0."DfltWH" = T2."WhsCode"
WHERE T0."validFor" = 'Y'
  AND (
    UPPER(T0."ItemCode") LIKE UPPER(?)
    OR UPPER(T0."ItemName") LIKE UPPER(?)
  )
ORDER BY T0."ItemCode"
${limitClause}
`.trim();
}

export function buildItemDetailSql(schema) {
  const s = quoteSchema(schema);
  const resolvedWh = `COALESCE(NULLIF(NULLIF(T0."DfltWH", ''), '-'), W1."WhsCode")`;
  return `
SELECT
  T0."ItemCode" AS "itemCode",
  T0."ItemName" AS "itemName",
  T0."UgpEntry" AS "ugpEntry",
  T1."UgpCode" AS "uomCode",
  T1."UgpName" AS "uom",
  T3."ItmsGrpCod" AS "itemGroupCode",
  T3."ItmsGrpNam" AS "itemGroupName",
  ${resolvedWh} AS "warehouseCode",
  T2."WhsName" AS "warehouseName",
  T0."AvgPrice" AS "price"
FROM ${s}."OITM" T0
LEFT JOIN ${s}."OUGP" T1
  ON T0."UgpEntry" = T1."UgpEntry"
LEFT JOIN ${s}."OITB" T3
  ON T0."ItmsGrpCod" = T3."ItmsGrpCod"
LEFT JOIN (
  SELECT
    "ItemCode",
    MIN("WhsCode") AS "WhsCode"
  FROM ${s}."OITW"
  GROUP BY "ItemCode"
) W1
  ON T0."ItemCode" = W1."ItemCode"
LEFT JOIN ${s}."OWHS" T2
  ON ${resolvedWh} = T2."WhsCode"
WHERE T0."ItemCode" = ?
`.trim();
}

export function buildUomGroupsSql(schema, limit = 100, limitStyle = resolveLimitStyle()) {
  const s = quoteSchema(schema);
  const limitClause = buildLimitClause(limit, limitStyle);
  return `
SELECT
  T0."UgpEntry" AS "value",
  T0."UgpName" AS "label",
  T0."UgpCode" AS "code"
FROM ${s}."OUGP" T0
ORDER BY T0."UgpName"
${limitClause}
`.trim();
}

export function buildItemGroupsSql(schema, limit = 100, limitStyle = resolveLimitStyle()) {
  const s = quoteSchema(schema);
  const limitClause = buildLimitClause(limit, limitStyle);
  return `
SELECT
  T0."ItmsGrpCod" AS "value",
  T0."ItmsGrpNam" AS "label",
  T0."ItmsGrpCod" AS "code"
FROM ${s}."OITB" T0
ORDER BY T0."ItmsGrpNam"
${limitClause}
`.trim();
}

export function buildAccountsSql(schema) {
  const s = quoteSchema(schema);
  return `
SELECT
  T0."AcctCode" AS "code",
  T0."AcctName" AS "name"
FROM ${s}."OACT" T0
WHERE T0."Postable" = 'Y'
  AND (
    UPPER(T0."AcctCode") LIKE UPPER(?)
    OR UPPER(COALESCE(T0."AcctName", '')) LIKE UPPER(?)
  )
ORDER BY T0."AcctCode"
LIMIT ?
`.trim();
}

/** Valid values (UFD1) declared for the OITM Company UDF. May be empty. */
export function buildCompanyValidValuesSql(schema) {
  const s = quoteSchema(schema);
  return `
SELECT
  TRIM(T1."FldValue") AS "code",
  TRIM(COALESCE(T1."Descr", '')) AS "name"
FROM ${s}."CUFD" T0
INNER JOIN ${s}."UFD1" T1
  ON T1."TableID" = T0."TableID"
 AND T1."FieldID" = T0."FieldID"
WHERE T0."TableID" = 'OITM'
  AND UPPER(T0."AliasID") = 'COMPANY'
  AND TRIM(COALESCE(T1."FldValue", '')) <> ''
  AND (
    UPPER(T1."FldValue") LIKE UPPER(?)
    OR UPPER(COALESCE(T1."Descr", '')) LIKE UPPER(?)
  )
ORDER BY T1."IndexID"
LIMIT ?
`.trim();
}

/** Values actually stored in OITM.U_Company (source of truth when UFD1 is empty). */
export function buildCompanyUsedValuesSql(schema) {
  const s = quoteSchema(schema);
  return `
SELECT DISTINCT
  TRIM(T0."U_Company") AS "code"
FROM ${s}."OITM" T0
WHERE TRIM(COALESCE(T0."U_Company", '')) <> ''
  AND UPPER(TRIM(T0."U_Company")) LIKE UPPER(?)
ORDER BY "code"
LIMIT ?
`.trim();
}

export function buildWarehousesSql(schema, limit = 100, limitStyle = resolveLimitStyle()) {
  const s = quoteSchema(schema);
  const limitClause = buildLimitClause(limit, limitStyle);
  return `
SELECT
  T0."WhsCode" AS "value",
  T0."WhsName" AS "label",
  T0."WhsCode" AS "code"
FROM ${s}."OWHS" T0
ORDER BY T0."WhsName"
${limitClause}
`.trim();
}

export function buildVendorCrd13CurrencySql(schema) {
  const s = quoteSchema(schema);
  return `
SELECT
  T0."CurrCode" AS "currencyCode",
  T0."INCLUDE" AS "included",
  T0."Locked" AS "locked",
  T1."CurrName" AS "currencyName"
FROM ${s}."CRD13" T0
LEFT JOIN ${s}."OCRN" T1
  ON T0."CurrCode" = T1."CurrCode"
WHERE T0."CardCode" = ?
  AND T0."INCLUDE" = 'Y'
ORDER BY T0."CurrCode"
`.trim();
}

export function buildVendorHeaderCurrencySql(schema) {
  const s = quoteSchema(schema);
  return `
SELECT
  T0."CardCode" AS "cardCode",
  T0."CardName" AS "cardName",
  T0."Currency" AS "bpCurrency"
FROM ${s}."OCRD" T0
WHERE T0."CardCode" = ?
`.trim();
}

/** @deprecated Use buildVendorCrd13CurrencySql for multi-currency CRD13 lookups. */
export function buildVendorCurrencySql(schema) {
  return buildVendorCrd13CurrencySql(schema);
}

export function buildCompanyLocalCurrencySql(schema) {
  const s = quoteSchema(schema);
  return `
SELECT TOP 1
  T0."MainCurncy" AS "localCurrency",
  T0."SysCurrncy" AS "systemCurrency"
FROM ${s}."OADM" T0
`.trim();
}

/** Company local + system currencies from OADM. */
export function buildCompanyCurrenciesSql(schema) {
  return buildCompanyLocalCurrencySql(schema);
}

/** Exchange rate for a currency on an exact document date (ORTT). */
export function buildExchangeRateSql(schema) {
  const s = quoteSchema(schema);
  return `
SELECT TOP 1
  T0."Currency" AS "currency",
  T0."RateDate" AS "rateDate",
  T0."Rate" AS "rate"
FROM ${s}."ORTT" T0
WHERE T0."Currency" = ?
  AND TO_VARCHAR(T0."RateDate", 'YYYY-MM-DD') = ?
`.trim();
}

export function buildVendorSearchSql(schema, limit = 20, offset = 0, limitStyle = resolveLimitStyle()) {
  const s = quoteSchema(schema);
  const limitClause = buildLimitClause(limit, limitStyle);
  const safeOffset = Math.max(0, Number(offset) || 0);
  const offsetClause = safeOffset > 0 ? `OFFSET ${safeOffset} ROWS` : '';
  return `
SELECT
  T0."CardCode" AS "vendorCode",
  T0."CardName" AS "vendorName",
  T0."CardFName" AS "foreignName",
  T0."Currency" AS "currency"
FROM ${s}."OCRD" T0
WHERE T0."CardType" = 'S'
  AND T0."validFor" = 'Y'
  AND (T0."frozenFor" = 'N' OR T0."frozenFor" IS NULL)
  AND (
    UPPER(T0."CardCode") LIKE UPPER(?)
    OR UPPER(T0."CardName") LIKE UPPER(?)
    OR UPPER(T0."CardFName") LIKE UPPER(?)
  )
ORDER BY T0."CardCode"
${offsetClause}
${limitClause}
`.trim();
}

export function buildVendorSearchCountSql(schema) {
  const s = quoteSchema(schema);
  return `
SELECT COUNT(*) AS "total"
FROM ${s}."OCRD" T0
WHERE T0."CardType" = 'S'
  AND T0."validFor" = 'Y'
  AND (T0."frozenFor" = 'N' OR T0."frozenFor" IS NULL)
  AND (
    UPPER(T0."CardCode") LIKE UPPER(?)
    OR UPPER(T0."CardName") LIKE UPPER(?)
    OR UPPER(T0."CardFName") LIKE UPPER(?)
  )
`.trim();
}
