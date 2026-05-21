import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  mapPoFromPrToSap,
  linesForVendor,
  vendorsFromPrLines,
  resolvePrBaseLineNum,
  SAP_PR_BASE_TYPE,
} from '@/lib/sap/mappers/poToSap';

describe('poToSap mapper', () => {
  const pr = {
    portalPRNumber: 'PR-20260521-0001',
    sapPRDocNum: '100',
    sapPRDocEntry: 42,
    department: 'IT',
    requiredDate: new Date('2026-05-21'),
    documentDate: new Date('2026-05-20'),
    warehouse: 'WH01',
    project: 'P1',
    sapResponse: {
      DocumentLines: [{ ItemCode: 'A1', LineNum: 0 }, { ItemCode: 'B2', LineNum: 1 }],
    },
    lines: [
      { _id: '1', itemCode: 'A1', quantity: 5, orderedQty: 0, vendor: 'V1', estimatedUnitPrice: 10 },
      { _id: '2', itemCode: 'B2', quantity: 3, orderedQty: 0, vendor: 'V2', estimatedUnitPrice: 20 },
    ],
  };

  it('extracts vendors from PR lines', () => {
    expect(vendorsFromPrLines(pr)).toEqual(['V1', 'V2']);
  });

  it('filters lines by vendor with remaining qty', () => {
    expect(linesForVendor(pr, 'V1')).toHaveLength(1);
    expect(linesForVendor(pr, 'V1')[0].itemCode).toBe('A1');
  });

  it('resolves SAP PR base line from sapResponse', () => {
    expect(resolvePrBaseLineNum(pr, pr.lines[1], 1)).toBe(1);
  });

  it('maps PO from PR with SAP base document references', () => {
    const payload = mapPoFromPrToSap(pr, { vendor: 'V1', branchMap: { IT: 2 } });
    expect(payload.CardCode).toBe('V1');
    expect(payload.BPL_IDAssignedToInvoice).toBe(2);
    expect(payload.DocumentLines).toHaveLength(1);
    expect(payload.DocumentLines[0].BaseType).toBe(SAP_PR_BASE_TYPE);
    expect(payload.DocumentLines[0].BaseEntry).toBe(42);
    expect(payload.DocumentLines[0].BaseLine).toBe(0);
    expect(payload.DocumentLines[0].Quantity).toBe(5);
  });
});
