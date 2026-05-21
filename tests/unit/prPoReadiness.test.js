import { describe, expect, it } from 'vitest';
import { prHasOpenPoSlots, enrichPrForPoList } from '@/lib/prPoReadiness';

describe('prPoReadiness', () => {
  const basePr = {
    _id: 'pr1',
    status: 'Created in SAP',
    sapPRDocEntry: 10,
    lines: [
      { itemCode: 'A', quantity: 5, orderedQty: 0, vendor: 'V1' },
      { itemCode: 'B', quantity: 3, orderedQty: 0, vendor: 'V2' },
    ],
  };

  it('detects open PO slots when vendors lack PO', () => {
    expect(prHasOpenPoSlots(basePr, [])).toBe(true);
  });

  it('closes slots when all vendors have SAP PO', () => {
    const orders = [
      { relatedPRId: 'pr1', vendor: 'V1', sapPODocEntry: 1 },
      { relatedPRId: 'pr1', vendor: 'V2', sapPODocEntry: 2 },
    ];
    expect(prHasOpenPoSlots(basePr, orders)).toBe(false);
  });

  it('supports partial ordering status', () => {
    const partial = {
      ...basePr,
      status: 'Partially Ordered',
      lines: [{ itemCode: 'A', quantity: 5, orderedQty: 5, vendor: 'V1' }, { itemCode: 'B', quantity: 3, orderedQty: 0, vendor: 'V2' }],
    };
    expect(prHasOpenPoSlots(partial, [{ relatedPRId: 'pr1', vendor: 'V1', sapPODocEntry: 1 }])).toBe(true);
  });

  it('enriches PR list metadata', () => {
    const meta = enrichPrForPoList(basePr, []);
    expect(meta.poReady).toBe(true);
    expect(meta.pendingVendors).toEqual(['V1', 'V2']);
  });
});
