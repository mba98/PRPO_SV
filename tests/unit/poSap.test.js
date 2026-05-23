import { describe, expect, it } from 'vitest';
import { mapPoToSapFromPortalRecord } from '@/lib/sap/mappers/poToSap';
import { buildPrCloseCommentAppendix } from '@/lib/sap/poPrFollowUpSap';

describe('PO SAP standalone mapper', () => {
  const po = {
    portalPONumber: 'PO-1',
    relatedPRNumber: 'PR-1',
    relatedSAPPRDocEntry: 42,
    relatedSAPPRDocNum: '100',
    vendor: 'V1',
    documentDate: new Date('2026-05-21'),
    dueDate: new Date('2026-05-22'),
    docRate: 1350,
    remarks: 'Portal note',
    lines: [
      {
        itemCode: 'A1',
        quantity: 3,
        unitPrice: 10,
        sapPRBaseLine: 0,
        warehouseCode: 'RAN004',
        uomCode: 'PCS',
      },
    ],
  };

  it('does not send PR base document references on lines', () => {
    const payload = mapPoToSapFromPortalRecord(po, { sapPRDocEntry: 42 });
    expect(payload.CardCode).toBe('V1');
    expect(payload.DocCurrency).toBe('USD');
    expect(payload.DocRate).toBe(1350);
    expect(payload.DocumentLines[0].BaseType).toBeUndefined();
    expect(payload.DocumentLines[0].BaseEntry).toBeUndefined();
    expect(payload.DocumentLines[0].BaseLine).toBeUndefined();
    expect(payload.DocumentLines[0].LineVendor).toBeUndefined();
  });

  it('buildPrCloseCommentAppendix includes PO references', () => {
    expect(buildPrCloseCommentAppendix(99, '500')).toContain('DocEntry 99');
    expect(buildPrCloseCommentAppendix(99, '500')).toContain('DocNum 500');
  });
});
