import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  mapApReserveInvoiceToSap,
  buildApriLinesFromPo,
  resolvePoSapLineNum,
  SAP_PO_BASE_TYPE,
} from '@/lib/sap/mappers/apReserveInvoiceToSap';

describe('apReserveInvoiceToSap mapper', () => {
  const po = {
    sapPODocEntry: 489,
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

  const originalCurrency = process.env.DEFAULT_PO_DOC_CURRENCY;
  const originalRate = process.env.DEFAULT_PO_DOC_RATE;

  beforeEach(() => {
    process.env.DEFAULT_PO_DOC_CURRENCY = 'USD';
    process.env.DEFAULT_PO_DOC_RATE = '1350';
  });

  afterEach(() => {
    process.env.DEFAULT_PO_DOC_CURRENCY = originalCurrency;
    process.env.DEFAULT_PO_DOC_RATE = originalRate;
  });

  function makeApri(overrides = {}) {
    return {
      vendor: 'V000005',
      documentDate: new Date('2026-05-23'),
      dueDate: new Date('2026-05-23'),
      taxDate: new Date('2026-05-23'),
      remarks: 'AP Reserve Invoice based on PO 2600023',
      relatedSAPPODocEntry: 489,
      relatedSAPPODocNum: '2600023',
      docCurrency: 'USD',
      docRate: 1350,
      lines: buildApriLinesFromPo(po),
      ...overrides,
    };
  }

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

  it('produces the Postman-confirmed PurchaseInvoices payload', () => {
    const apri = makeApri({
      lines: [
        {
          relatedPOLineNum: 0,
          itemCode: 'A1',
          quantity: 1,
        },
      ],
    });

    const payload = mapApReserveInvoiceToSap(apri);

    expect(payload).toEqual({
      CardCode: 'V000005',
      DocDate: '2026-05-23',
      DocDueDate: '2026-05-23',
      TaxDate: '2026-05-23',
      DocCurrency: 'USD',
      DocRate: 1350,
      ReserveInvoice: 'tYES',
      Comments: 'AP Reserve Invoice based on PO 2600023',
      DocumentLines: [
        {
          BaseType: 22,
          BaseEntry: 489,
          BaseLine: 0,
          Quantity: 1,
        },
      ],
    });
  });

  it('always includes DocCurrency USD and DocRate 1350 from env defaults', () => {
    const apri = makeApri({ docCurrency: undefined, docRate: undefined });

    const payload = mapApReserveInvoiceToSap(apri);

    expect(payload.DocCurrency).toBe('USD');
    expect(payload.DocRate).toBe(1350);
  });

  it('includes TaxDate matching documentDate when taxDate not provided', () => {
    const apri = makeApri({ taxDate: undefined });

    const payload = mapApReserveInvoiceToSap(apri);

    expect(payload.TaxDate).toBe('2026-05-23');
  });

  it('sets ReserveInvoice to tYES', () => {
    const payload = mapApReserveInvoiceToSap(makeApri());
    expect(payload.ReserveInvoice).toBe('tYES');
  });

  it('builds DocumentLines with BaseType 22, BaseEntry and BaseLine only', () => {
    const apri = makeApri();
    const payload = mapApReserveInvoiceToSap(apri);

    expect(payload.DocumentLines).toHaveLength(2);
    payload.DocumentLines.forEach((line) => {
      expect(line.BaseType).toBe(SAP_PO_BASE_TYPE);
      expect(line.BaseEntry).toBe(489);
      expect(typeof line.BaseLine).toBe('number');
      expect(typeof line.Quantity).toBe('number');
    });
    expect(payload.DocumentLines[0].BaseLine).toBe(0);
    expect(payload.DocumentLines[1].BaseLine).toBe(1);
  });

  it('omits ItemCode / WarehouseCode / UoMCode / Currency / Rate on lines when base refs are used', () => {
    const apri = makeApri();
    const payload = mapApReserveInvoiceToSap(apri);

    payload.DocumentLines.forEach((line) => {
      expect(line).not.toHaveProperty('ItemCode');
      expect(line).not.toHaveProperty('WarehouseCode');
      expect(line).not.toHaveProperty('UoMCode');
      expect(line).not.toHaveProperty('Currency');
      expect(line).not.toHaveProperty('Rate');
      expect(line).not.toHaveProperty('ProjectCode');
      expect(line).not.toHaveProperty('CostingCode');
    });
  });

  it('builds default Comments when remarks are missing', () => {
    const apri = makeApri({ remarks: undefined });
    const payload = mapApReserveInvoiceToSap(apri);
    expect(payload.Comments).toBe('AP Reserve Invoice based on PO 2600023');
  });

  it('throws when BaseEntry missing', () => {
    expect(() =>
      mapApReserveInvoiceToSap({
        vendor: 'V',
        lines: [{ relatedPOLineNum: 0, itemCode: 'A', quantity: 1 }],
      }),
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
