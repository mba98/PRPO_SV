import { describe, expect, it } from 'vitest';
import {
  buildItemSearchSql,
  buildItemDetailSql,
  buildUomGroupsSql,
  buildWarehousesSql,
  buildVendorCrd13CurrencySql,
  buildVendorHeaderCurrencySql,
  buildVendorCurrencySql,
  buildLimitClause,
  quoteSchema,
} from '@/lib/sap/hanaSql';

describe('sap HANA SQL builders', () => {
  it('quotes company schema', () => {
    expect(quoteSchema('SBODEMOUS')).toBe('"SBODEMOUS"');
  });

  it('builds item search SQL with OITM/OITB/OWHS join and warehouse aliases', () => {
    const sql = buildItemSearchSql('SBODEMOUS', 20, 'limit');
    expect(sql).toContain('"SBODEMOUS"."OITM"');
    expect(sql).toContain('LEFT JOIN "SBODEMOUS"."OITB"');
    expect(sql).toContain('LEFT JOIN "SBODEMOUS"."OWHS"');
    expect(sql).toContain('AS "warehouseCode"');
    expect(sql).toContain('AS "warehouseName"');
    expect(sql).toContain('UPPER(?)');
    expect(sql).toContain('LIMIT 20');
  });

  it('supports FETCH FIRST limit style', () => {
    const sql = buildItemSearchSql('DB', 10, 'fetch');
    expect(sql).toContain('FETCH FIRST 10 ROWS ONLY');
  });

  it('builds item detail SQL', () => {
    const sql = buildItemDetailSql('MYCO');
    expect(sql).toContain('T0."ItemCode" = ?');
    expect(sql).toContain('T3."ItmsGrpNam"');
  });

  it('buildLimitClause caps range', () => {
    expect(buildLimitClause(200, 'limit')).toBe('LIMIT 100');
  });

  it('builds UoM groups SQL with OUGP aliases for OITM.UgpEntry', () => {
    const sql = buildUomGroupsSql('SBODEMOUS', 50, 'limit');
    expect(sql).toContain('"SBODEMOUS"."OUGP" T0');
    expect(sql).toContain('T0."UgpEntry" AS "value"');
    expect(sql).toContain('T0."UgpName" AS "label"');
    expect(sql).toContain('T0."UgpCode" AS "code"');
    expect(sql).toContain('ORDER BY T0."UgpName"');
    expect(sql).toContain('LIMIT 50');
  });

  it('builds item detail SQL with OITW warehouse fallback and response aliases', () => {
    const sql = buildItemDetailSql('MYCO');
    expect(sql).toContain('"MYCO"."OUGP"');
    expect(sql).toContain('"MYCO"."OWHS"');
    expect(sql).toContain('"MYCO"."OITW"');
    expect(sql).toContain('MIN("WhsCode")');
    expect(sql).toContain('COALESCE(NULLIF(NULLIF(T0."DfltWH", \'\'), \'-\'), W1."WhsCode")');
    expect(sql).not.toContain('CROSS JOIN');
    expect(sql).toContain('AS "warehouseCode"');
    expect(sql).toContain('AS "warehouseName"');
    expect(sql).toContain('AS "uomCode"');
    expect(sql).toContain('AS "ugpEntry"');
    expect(sql).toContain('AS "uom"');
    expect(sql).toContain('AS "price"');
  });

  it('builds CRD13-only vendor currency SQL', () => {
    const sql = buildVendorCrd13CurrencySql('DB');
    expect(sql).toContain('"DB"."CRD13" T0');
    expect(sql).toContain('T0."CurrCode" AS "currencyCode"');
    expect(sql).toContain('T0."INCLUDE" AS "included"');
    expect(sql).toContain('T0."Locked" AS "locked"');
    expect(sql).toContain('T0."INCLUDE" = \'Y\'');
    expect(sql).toContain('T0."CardCode" = ?');
    expect(sql).not.toContain('"OCRD"');
  });

  it('builds OCRD header currency SQL', () => {
    const sql = buildVendorHeaderCurrencySql('DB');
    expect(sql).toContain('"DB"."OCRD" T0');
    expect(sql).toContain('T0."Currency" AS "bpCurrency"');
    expect(sql).toContain('T0."CardCode" = ?');
  });

  it('keeps buildVendorCurrencySql as CRD13 alias', () => {
    expect(buildVendorCurrencySql('DB')).toBe(buildVendorCrd13CurrencySql('DB'));
  });
});
