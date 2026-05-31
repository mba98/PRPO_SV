import { describe, expect, it } from 'vitest';
import {
  prHasOpenPoSlots,
  prHasPortalPurchaseOrder,
  prIsEligibleForReadyForPoList,
  enrichPrForPoList,
} from '@/lib/prPoReadiness';

describe('prPoReadiness', () => {
  const basePr = {
    _id: 'pr1',
    status: 'Created in SAP',
    sapPRDocEntry: 10,
    sapPRDocNum: '2600020',
    lines: [
      { itemCode: 'A', quantity: 5, orderedQty: 0, vendor: 'V1' },
      { itemCode: 'B', quantity: 3, orderedQty: 0, vendor: 'V2' },
    ],
  };

  it('detects open PO slots when vendors lack PO', () => {
    expect(prHasOpenPoSlots(basePr, [])).toBe(true);
  });

  it('closes slots when each vendor already has a portal PO', () => {
    const orders = [
      { relatedPRId: 'pr1', vendor: 'V1', status: 'Pending Project Manager Approval' },
      { relatedPRId: 'pr1', vendor: 'V2', status: 'Created in SAP', sapPODocEntry: 2 },
    ];
    expect(prHasOpenPoSlots(basePr, orders)).toBe(false);
  });

  it('supports partial ordering status', () => {
    const partial = {
      ...basePr,
      status: 'Partially Ordered',
      lines: [
        { itemCode: 'A', quantity: 5, orderedQty: 5, vendor: 'V1' },
        { itemCode: 'B', quantity: 3, orderedQty: 0, vendor: 'V2' },
      ],
    };
    expect(prHasOpenPoSlots(partial, [{ relatedPRId: 'pr1', vendor: 'V1', sapPODocEntry: 1 }])).toBe(
      true,
    );
  });

  it('enriches PR list metadata', () => {
    const meta = enrichPrForPoList(basePr, []);
    expect(meta.poReady).toBe(true);
    expect(meta.pendingVendors).toEqual(['V1', 'V2']);
  });

  it('PR with portal PO is not eligible for ready-for-PO list', () => {
    const orders = [
      {
        relatedPRId: 'pr1',
        vendor: 'V000005',
        status: 'Pending Project Manager Approval',
        portalPONumber: 'PO-20260531-0001',
      },
    ];
    expect(prHasPortalPurchaseOrder(basePr, orders)).toBe(true);
    expect(prIsEligibleForReadyForPoList(basePr, orders)).toBe(false);
    expect(enrichPrForPoList(basePr, orders).poReady).toBe(false);
  });

  it('PR with SAP PR and no PO is eligible', () => {
    expect(prIsEligibleForReadyForPoList(basePr, [])).toBe(true);
  });

  it('PR with relatedPortalPONumber on document is excluded', () => {
    const pr = { ...basePr, relatedPortalPONumber: 'PO-20260531-0001' };
    expect(prHasPortalPurchaseOrder(pr, [])).toBe(true);
    expect(prIsEligibleForReadyForPoList(pr, [])).toBe(false);
  });

  it('fully ordered PR is not eligible', () => {
    const pr = { ...basePr, status: 'Fully Ordered' };
    expect(prIsEligibleForReadyForPoList(pr, [])).toBe(false);
  });
});
