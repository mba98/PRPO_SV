import { describe, expect, it } from 'vitest';
import {
  buildItemSearchSql,
  buildItemDetailSql,
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
    expect(sql).toContain('T1."ItmsGrpNam"');
  });

  it('buildLimitClause caps range', () => {
    expect(buildLimitClause(200, 'limit')).toBe('LIMIT 100');
  });
});
