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

  it('allows optional comment on approve/reject', () => {
    expect(approveRejectPoSchema.safeParse({ comment: 'OK', __v: 0 }).success).toBe(true);
  });

  it('allows partial PO update', () => {
    expect(updatePurchaseOrderSchema.safeParse({ remarks: 'note' }).success).toBe(true);
  });
});
