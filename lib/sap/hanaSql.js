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
  T0."ItemCode",
  T0."ItemName",
  T0."PurPackMsr",
  T0."BuyUnitMsr",
  T0."InvntryUom",
  T0."DfltWH",
  T0."UgpEntry",
  T0."ItmsGrpCod",
  T1."ItmsGrpNam"
FROM ${s}."OITM" T0
LEFT JOIN ${s}."OITB" T1
  ON T0."ItmsGrpCod" = T1."ItmsGrpCod"
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
  return `
SELECT
  T0."ItemCode",
  T0."ItemName",
  T0."PurPackMsr",
  T0."BuyUnitMsr",
  T0."InvntryUom",
  T0."DfltWH",
  T0."UgpEntry",
  T0."ItmsGrpCod",
  T1."ItmsGrpNam"
FROM ${s}."OITM" T0
LEFT JOIN ${s}."OITB" T1
  ON T0."ItmsGrpCod" = T1."ItmsGrpCod"
WHERE T0."ItemCode" = ?
  AND T0."validFor" = 'Y'
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
SELECT "ItmsGrpCod", "ItmsGrpNam"
FROM ${s}."OITB"
ORDER BY "ItmsGrpNam"
${limitClause}
`.trim();
}

export function buildAccountsSql(schema, limit = 100, limitStyle = resolveLimitStyle()) {
  const s = quoteSchema(schema);
  const limitClause = buildLimitClause(limit, limitStyle);
  return `
SELECT "AcctCode", "AcctName"
FROM ${s}."OACT"
WHERE "Postable" = 'Y'
ORDER BY "AcctName"
${limitClause}
`.trim();
}

export function buildCompanyValuesSql(schema, limit = 100, limitStyle = resolveLimitStyle()) {
  const s = quoteSchema(schema);
  const limitClause = buildLimitClause(limit, limitStyle);
  return `
SELECT DISTINCT "U_Company" AS "Company"
FROM ${s}."OITM"
WHERE "U_Company" IS NOT NULL AND TRIM("U_Company") <> ''
ORDER BY "U_Company"
${limitClause}
`.trim();
}
