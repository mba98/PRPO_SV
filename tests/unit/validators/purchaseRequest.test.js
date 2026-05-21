import { describe, expect, it } from 'vitest';
import {
  createPurchaseRequestSchema,
  approveRejectSchema,
  createSapItemSchema,
} from '@/lib/validators/purchaseRequest';

describe('purchaseRequest validators', () => {
  it('requires header fields and at least one line', () => {
    const valid = createPurchaseRequestSchema.safeParse({
      department: 'Operations',
      requiredDate: '2026-05-21',
      lines: [{ itemCode: 'A001', quantity: 2 }],
    });
    expect(valid.success).toBe(true);

    const invalid = createPurchaseRequestSchema.safeParse({
      department: 'Operations',
      requiredDate: '2026-05-21',
      lines: [],
    });
    expect(invalid.success).toBe(false);
  });

  it('validates approve/reject comment as optional', () => {
    expect(approveRejectSchema.safeParse({ comment: 'OK' }).success).toBe(true);
    expect(approveRejectSchema.safeParse({}).success).toBe(true);
  });

  it('requires ItemCode and ItemName for SAP item create', () => {
    expect(createSapItemSchema.safeParse({ ItemCode: 'X', ItemName: 'Item' }).success).toBe(true);
    expect(createSapItemSchema.safeParse({ ItemCode: 'X' }).success).toBe(false);
  });
});
