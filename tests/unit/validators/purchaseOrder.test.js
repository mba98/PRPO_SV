import { describe, expect, it } from 'vitest';
import {
  createPoFromPrSchema,
  approveRejectPoSchema,
  updatePurchaseOrderSchema,
} from '@/lib/validators/purchaseOrder';

describe('purchaseOrder validators', () => {
  it('requires vendor for PO from PR', () => {
    expect(createPoFromPrSchema.safeParse({ vendor: 'V1' }).success).toBe(true);
    expect(createPoFromPrSchema.safeParse({}).success).toBe(false);
  });

  it('accepts docCurrency USD or IQD on create from PR', () => {
    expect(
      createPoFromPrSchema.safeParse({ vendor: 'V1', docCurrency: 'IQD', docRate: null }).success,
    ).toBe(true);
    expect(
      createPoFromPrSchema.safeParse({ vendor: 'V1', docCurrency: 'USD', docRate: 1350 }).success,
    ).toBe(true);
    expect(createPoFromPrSchema.safeParse({ vendor: 'V1', docCurrency: 'EUR' }).success).toBe(
      false,
    );
  });

  it('accepts docCurrency on PO update', () => {
    expect(updatePurchaseOrderSchema.safeParse({ docCurrency: 'IQD' }).success).toBe(true);
  });

  it('allows optional comment on approve/reject', () => {
    expect(approveRejectPoSchema.safeParse({ comment: 'OK', __v: 0 }).success).toBe(true);
  });

  it('allows partial PO update', () => {
    expect(updatePurchaseOrderSchema.safeParse({ remarks: 'note' }).success).toBe(true);
  });
});
