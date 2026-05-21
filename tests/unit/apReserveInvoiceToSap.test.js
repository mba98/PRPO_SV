import { describe, expect, it } from 'vitest';
import {
  mapApReserveInvoiceToSap,
  buildApriLinesFromPo,
  resolvePoSapLineNum,
  SAP_PO_BASE_TYPE,
} from '@/lib/sap/mappers/apReserveInvoiceToSap';

describe('apReserveInvoiceToSap mapper', () => {
  const po = {
    sapPODocEntry: 99,
    warehouse: 'WH01',
    project: 'P1',
    sapResponse: {
      DocumentLines: [
        { ItemCode: 'A1', LineNum: 0 },
        { ItemCode: 'B2', LineNum: 1 },
      ],
    },
    lines: [
      { _id: 'l1', itemCode: 'A1', itemName: 'Item A', quantity: 2, unitPrice: 10, lineTotal: 20 },
      { _id: 'l2', itemCode: 'B2', itemName: 'Item B', quantity: 1, unitPrice: 5, lineTotal: 5 },
    ],
  };

  it('resolves SAP PO line number from sapResponse', () => {
    expect(resolvePoSapLineNum(po, po.lines[1], 1)).toBe(1);
  });

  it('builds APRI lines with related POLineNum', () => {
    const lines = buildApriLinesFromPo(po);
    expect(lines).toHaveLength(2);
    expect(lines[0].relatedPOLineNum).toBe(0);
    expect(lines[1].relatedPOLineNum).toBe(1);
  });

  it('skips PO lines without SAP LineNum', () => {
    const noSap = { ...po, sapResponse: null, lines: [{ itemCode: 'X', quantity: 1 }] };
    expect(buildApriLinesFromPo(noSap)).toHaveLength(0);
  });

  it('maps APRI to SAP PurchaseInvoices with reserve and PO base refs', () => {
    const apri = {
      vendor: 'V001',
      documentDate: new Date('2026-05-21'),
      dueDate: new Date('2026-05-28'),
      remarks: 'Test',
      relatedSAPPODocEntry: 99,
      lines: buildApriLinesFromPo(po),
    };
    const payload = mapApReserveInvoiceToSap(apri);
    expect(payload.ReserveInvoice).toBe('tYES');
    expect(payload.CardCode).toBe('V001');
    expect(payload.DocumentLines).toHaveLength(2);
    expect(payload.DocumentLines[0].BaseType).toBe(SAP_PO_BASE_TYPE);
    expect(payload.DocumentLines[0].BaseEntry).toBe(99);
    expect(payload.DocumentLines[0].BaseLine).toBe(0);
  });

  it('throws when BaseEntry missing', () => {
    expect(() =>
      mapApReserveInvoiceToSap({ vendor: 'V', lines: [{ relatedPOLineNum: 0, itemCode: 'A', quantity: 1 }] }),
    ).toThrow(/DocEntry/);
  });

  it('throws when line missing PO base reference', () => {
    expect(() =>
      mapApReserveInvoiceToSap({
        vendor: 'V',
        relatedSAPPODocEntry: 1,
        lines: [{ itemCode: 'A', quantity: 1 }],
      }),
    ).toThrow(/base reference/);
  });
});
