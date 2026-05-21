import { describe, expect, it } from 'vitest';
import { mapPoToSapFromPortalRecord, SAP_PR_BASE_TYPE } from '@/lib/sap/mappers/poToSap';

describe('PO SAP creation guard (mapper)', () => {
  const po = {
    portalPONumber: 'PO-1',
    relatedPRNumber: 'PR-1',
    relatedSAPPRDocEntry: 42,
    vendor: 'V1',
    department: 'IT',
    requiredDate: new Date('2026-05-21'),
    lines: [
      {
        itemCode: 'A1',
        quantity: 3,
        unitPrice: 10,
        sapPRBaseLine: 0,
        warehouseCode: 'WH1',
      },
    ],
  };

  it('maps portal PO with PR base document references', () => {
    const payload = mapPoToSapFromPortalRecord(po, { sapPRDocEntry: 42 }, { branchMap: { IT: 2 } });
    expect(payload.CardCode).toBe('V1');
    expect(payload.DocumentLines[0].BaseType).toBe(SAP_PR_BASE_TYPE);
    expect(payload.DocumentLines[0].BaseEntry).toBe(42);
    expect(payload.DocumentLines[0].BaseLine).toBe(0);
    expect(payload.DocumentLines[0].Quantity).toBe(3);
  });
});
