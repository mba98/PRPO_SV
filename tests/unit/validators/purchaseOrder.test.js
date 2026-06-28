import { describe, expect, it } from 'vitest';
import {
  createPoFromPrSchema,
  approveRejectPoSchema,
  updatePurchaseOrderSchema,
} from '@/lib/validators/purchaseOrder';

const sampleLine = {
  itemCode: 'ITEM1',
  quantity: 2,
  unitPrice: 50,
  warehouseCode: '01',
  uomCode: 'PCS',
};

describe('purchaseOrder validators', () => {
  it('requires vendor and lines for PO from PR', () => {
    expect(
      createPoFromPrSchema.safeParse({ vendor: 'V1', lines: [sampleLine] }).success,
    ).toBe(true);
    expect(createPoFromPrSchema.safeParse({ vendor: 'V1' }).success).toBe(false);
    expect(createPoFromPrSchema.safeParse({ lines: [sampleLine] }).success).toBe(false);
  });

  it('accepts valid docCurrency codes and rejects ## on create from PR', () => {
    expect(
      createPoFromPrSchema.safeParse({
        vendor: 'V1',
        docCurrency: 'IQD',
        docRate: null,
        lines: [sampleLine],
      }).success,
    ).toBe(true);
    expect(
      createPoFromPrSchema.safeParse({
        vendor: 'V1',
        docCurrency: 'USD',
        docRate: 1350,
        lines: [sampleLine],
      }).success,
    ).toBe(true);
    expect(
      createPoFromPrSchema.safeParse({ vendor: 'V1', docCurrency: 'EUR', lines: [sampleLine] })
        .success,
    ).toBe(true);
    expect(
      createPoFromPrSchema.safeParse({ vendor: 'V1', docCurrency: '##', lines: [sampleLine] })
        .success,
    ).toBe(false);
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
