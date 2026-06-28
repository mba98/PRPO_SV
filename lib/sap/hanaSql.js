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

export function buildAccountsSql(schema, limit = 100, limitStyle = resolveLimitStyle()) {
  const s = quoteSchema(schema);
  const limitClause = buildLimitClause(limit, limitStyle);
  return `
SELECT
  T0."AcctCode" AS "value",
  T0."AcctName" AS "label",
  T0."AcctCode" AS "code"
FROM ${s}."OACT" T0
WHERE T0."Postable" = 'Y'
ORDER BY T0."AcctName"
${limitClause}
`.trim();
}

export function buildCompanyValuesSql(schema, limit = 100, limitStyle = resolveLimitStyle()) {
  const s = quoteSchema(schema);
  const limitClause = buildLimitClause(limit, limitStyle);
  return `
SELECT DISTINCT
  T0."U_Company" AS "value",
  T0."U_Company" AS "label",
  T0."U_Company" AS "code"
FROM ${s}."OITM" T0
WHERE T0."U_Company" IS NOT NULL AND TRIM(T0."U_Company") <> ''
ORDER BY T0."U_Company"
${limitClause}
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

export function buildVendorCurrencySql(schema) {
  const s = quoteSchema(schema);
  return `
SELECT
  T1."CurrCode" AS "currencyCode",
  T1."INCLUDE" AS "included",
  T1."Locked" AS "locked",
  T2."CurrName" AS "currencyName",
  T0."Currency" AS "BpCurrency"
FROM ${s}."OCRD" T0
LEFT JOIN ${s}."CRD13" T1
  ON T0."CardCode" = T1."CardCode"
  AND T1."INCLUDE" = 'Y'
LEFT JOIN ${s}."OCRN" T2
  ON T1."CurrCode" = T2."CurrCode"
WHERE T0."CardCode" = ?
ORDER BY T1."CurrCode"
`.trim();
}

export function buildCompanyLocalCurrencySql(schema) {
  const s = quoteSchema(schema);
  return `
SELECT TOP 1
  T0."MainCurncy" AS "MainCurncy"
FROM ${s}."OADM" T0
`.trim();
}
