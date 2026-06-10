import { describe, expect, it } from 'vitest';
import {
  buildItemSearchSql,
  buildItemDetailSql,
  buildUomGroupsSql,
  buildWarehousesSql,
  buildLimitClause,
  quoteSchema,
} from '@/lib/sap/hanaSql';

describe('sap HANA SQL builders', () => {
  it('quotes company schema', () => {
    expect(quoteSchema('SBODEMOUS')).toBe('"SBODEMOUS"');
  });

  it('builds item search SQL with OITM/OITB join', () => {
    const sql = buildItemSearchSql('SBODEMOUS', 20, 'limit');
    expect(sql).toContain('"SBODEMOUS"."OITM"');
    expect(sql).toContain('LEFT JOIN "SBODEMOUS"."OITB"');
    expect(sql).toContain('T1."ItmsGrpNam"');
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

  it('builds item detail SQL with OUGP and OWHS joins', () => {
    const sql = buildItemDetailSql('MYCO');
    expect(sql).toContain('"MYCO"."OUGP"');
    expect(sql).toContain('"MYCO"."OWHS"');
    expect(sql).toContain('T0."AvgPrice"');
    expect(sql).toContain('T1."UgpName"');
    expect(sql).toContain('T2."WhsName"');
  });

  it('builds warehouses SQL from OWHS', () => {
    const sql = buildWarehousesSql('DB', 100, 'limit');
    expect(sql).toContain('"DB"."OWHS" T0');
    expect(sql).toContain('T0."WhsCode" AS "value"');
    expect(sql).toContain('T0."WhsName" AS "label"');
  });
});
