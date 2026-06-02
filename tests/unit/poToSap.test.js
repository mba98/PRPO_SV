import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  mapPoFromPrToSap,
  mapPoToSapFromPortalRecord,
  mapPoToSap,
  buildPoTraceComments,
  validateStandaloneSapPoPayload,
  linesForVendor,
  vendorsFromPrLines,
  resolvePrBaseLineNum,
} from '@/lib/sap/mappers/poToSap';

describe('poToSap mapper (standalone)', () => {
  const pr = {
    portalPRNumber: 'PR-20260521-0001',
    sapPRDocNum: '100',
    sapPRDocEntry: 42,
    department: 'IT',
    requiredDate: new Date('2026-05-21'),
    documentDate: new Date('2026-05-20'),
    warehouse: 'WH01',
    sapResponse: {
      DocumentLines: [{ ItemCode: 'A1', LineNum: 0 }, { ItemCode: 'B2', LineNum: 1 }],
    },
    lines: [
      {
        _id: '1',
        itemCode: 'A1',
        quantity: 5,
        orderedQty: 0,
        vendor: 'V1',
        estimatedUnitPrice: 10,
        uomCode: 'PCS',
      },
      {
        _id: '2',
        itemCode: 'B2',
        quantity: 3,
        orderedQty: 0,
        vendor: 'V2',
        estimatedUnitPrice: 20,
      },
    ],
  };

  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it('extracts vendors from PR lines', () => {
    expect(vendorsFromPrLines(pr)).toEqual(['V1', 'V2']);
  });

  it('filters lines by vendor with remaining qty', () => {
    expect(linesForVendor(pr, 'V1')).toHaveLength(1);
    expect(linesForVendor(pr, 'V1')[0].itemCode).toBe('A1');
  });

  it('resolves SAP PR base line from sapResponse (portal only)', () => {
    expect(resolvePrBaseLineNum(pr, pr.lines[1], 1)).toBe(1);
  });

  it('maps standalone PO from PR without BaseType/BaseEntry/BaseLine', () => {
    const payload = mapPoFromPrToSap(pr, { vendor: 'V1' });
    expect(payload.CardCode).toBe('V1');
    expect(payload.DocCurrency).toBe('USD');
    expect(payload.DocumentLines).toHaveLength(1);
    expect(payload.DocumentLines[0].BaseType).toBeUndefined();
    expect(payload.DocumentLines[0].BaseEntry).toBeUndefined();
    expect(payload.DocumentLines[0].BaseLine).toBeUndefined();
    expect(payload.DocumentLines[0].Quantity).toBe(5);
    expect(payload.DocumentLines[0].UoMCode).toBe('PCS');
    expect(payload.Comments).toContain('PR-20260521-0001');
    expect(payload.Comments).toContain('42');
  });

  it('maps approved portal PO as standalone SAP payload', () => {
    const po = {
      portalPONumber: 'PO-1',
      relatedPRNumber: 'PR-1',
      relatedSAPPRDocEntry: 42,
      relatedSAPPRDocNum: '100',
      vendor: 'V1',
      documentDate: new Date('2026-05-21'),
      dueDate: new Date('2026-05-22'),
      docRate: 1350,
      lines: [{ itemCode: 'A1', quantity: 2, unitPrice: 5, uomCode: 'PCS', warehouseCode: 'RAN004' }],
    };
    const payload = mapPoToSapFromPortalRecord(po, { sapPRDocEntry: 42 });
    expect(payload.CardCode).toBe('V1');
    expect(payload.DocCurrency).toBe('USD');
    expect(payload.DocRate).toBe(1350);
    expect(payload.TaxDate).toBe(payload.DocDate);
    expect(payload.DocumentLines[0]).toEqual(
      expect.objectContaining({
        ItemCode: 'A1',
        Quantity: 2,
        UnitPrice: 5,
        WarehouseCode: 'RAN004',
        UoMCode: 'PCS',
      }),
    );
    expect(payload.DocumentLines[0].BaseType).toBeUndefined();
    expect(payload.DocumentLines[0].ProjectCode).toBeUndefined();
    expect(payload.DocumentLines[0].CostingCode).toBeUndefined();
  });

  it('falls back to default DocRate in production when PO has no docRate', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const po = {
      vendor: 'V1',
      documentDate: new Date('2026-05-21'),
      dueDate: new Date('2026-05-22'),
      lines: [{ itemCode: 'A1', quantity: 1, unitPrice: 5 }],
    };
    const payload = mapPoToSapFromPortalRecord(po, {});
    expect(payload.DocRate).toBe(1350);
  });

  it('sends IQD without DocRate even if legacy docRate exists on PO', () => {
    const po = {
      vendor: 'V1',
      docCurrency: 'IQD',
      docRate: 1350,
      documentDate: new Date('2026-05-21'),
      dueDate: new Date('2026-05-22'),
      lines: [{ itemCode: 'A1', quantity: 1, unitPrice: 5 }],
    };
    const payload = mapPoToSap(po);
    expect(payload.DocCurrency).toBe('IQD');
    expect(payload.DocRate).toBeUndefined();
  });

  it('sends USD with saved DocRate', () => {
    const po = {
      vendor: 'V1',
      docCurrency: 'USD',
      docRate: 1400,
      documentDate: new Date('2026-05-21'),
      dueDate: new Date('2026-05-22'),
      lines: [{ itemCode: 'A1', quantity: 1, unitPrice: 5 }],
    };
    const payload = mapPoToSap(po);
    expect(payload.DocCurrency).toBe('USD');
    expect(payload.DocRate).toBe(1400);
  });

  it('preserves saved IQD currency without USD default DocRate', () => {
    const po = {
      vendor: 'V1',
      docCurrency: 'IQD',
      documentDate: new Date('2026-05-21'),
      dueDate: new Date('2026-05-22'),
      lines: [{ itemCode: 'A1', quantity: 1, unitPrice: 5 }],
    };
    const payload = mapPoToSapFromPortalRecord(po, {});
    expect(payload.DocCurrency).toBe('IQD');
    expect(payload.DocRate).toBeUndefined();
  });

  it('validateStandaloneSapPoPayload rejects zero quantity', () => {
    const payload = mapPoToSap({
      vendor: 'V1',
      requiredDate: new Date('2026-05-21'),
      lines: [{ itemCode: 'A1', quantity: 0, unitPrice: 1 }],
    });
    const result = validateStandaloneSapPoPayload(payload);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('Quantity'))).toBe(true);
  });

  it('buildPoTraceComments joins remarks and PR references', () => {
    const text = buildPoTraceComments({
      remarks: 'Note',
      relatedPRNumber: 'PR-1',
      relatedSAPPRDocEntry: 42,
      relatedSAPPRDocNum: '100',
    });
    expect(text).toContain('Note');
    expect(text).toContain('Portal PR PR-1');
    expect(text).toContain('SAP PR DocEntry 42');
  });
});
