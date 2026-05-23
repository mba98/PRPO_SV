import { describe, expect, it } from 'vitest';
import {
  createPurchaseRequestSchema,
  approveRejectSchema,
  createSapItemSchema,
} from '@/lib/validators/purchaseRequest';

describe('purchaseRequest validators', () => {
  it('accepts the simplified payload (requiredDate + item/quantity/unit price)', () => {
    const valid = createPurchaseRequestSchema.safeParse({
      requiredDate: '2026-05-21',
      lines: [{ itemCode: 'ALR00027SV', quantity: 100, estimatedUnitPrice: 2222000 }],
    });
    expect(valid.success).toBe(true);
  });

  it('does not require department/project/warehouse/cost center', () => {
    const parsed = createPurchaseRequestSchema.safeParse({
      requiredDate: '2026-05-21',
      lines: [{ itemCode: 'A001', quantity: 2, estimatedUnitPrice: 50 }],
    });
    expect(parsed.success).toBe(true);
    // None of the removed fields are present after parsing.
    expect(parsed.data.department).toBeUndefined();
    expect(parsed.data.project).toBeUndefined();
    expect(parsed.data.warehouse).toBeUndefined();
    expect(parsed.data.lines[0].costCenter).toBeUndefined();
    expect(parsed.data.lines[0].warehouseCode).toBeUndefined();
  });

  it('accepts optional remarks and line vendor/remarks', () => {
    const parsed = createPurchaseRequestSchema.safeParse({
      requiredDate: '2026-05-21',
      remarks: 'Urgent',
      lines: [
        {
          itemCode: 'A001',
          quantity: 2,
          estimatedUnitPrice: 50,
          vendor: 'V1000',
          remarks: 'Line note',
        },
      ],
    });
    expect(parsed.success).toBe(true);
    expect(parsed.data.remarks).toBe('Urgent');
    expect(parsed.data.lines[0].vendor).toBe('V1000');
  });

  it('keeps legacy header/line fields optional for backward compatibility', () => {
    const parsed = createPurchaseRequestSchema.safeParse({
      department: 'Operations',
      warehouse: 'WH1',
      requiredDate: '2026-05-21',
      lines: [
        {
          itemCode: 'A001',
          quantity: 2,
          estimatedUnitPrice: 50,
          warehouseCode: 'WH1',
          projectCode: 'P1',
          costCenter: 'CC1',
        },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it('requires requiredDate', () => {
    const invalid = createPurchaseRequestSchema.safeParse({
      lines: [{ itemCode: 'A001', quantity: 2, estimatedUnitPrice: 50 }],
    });
    expect(invalid.success).toBe(false);
  });

  it('requires itemCode, quantity, and estimatedUnitPrice on each line', () => {
    expect(
      createPurchaseRequestSchema.safeParse({
        requiredDate: '2026-05-21',
        lines: [{ quantity: 1, estimatedUnitPrice: 1 }],
      }).success,
    ).toBe(false);

    expect(
      createPurchaseRequestSchema.safeParse({
        requiredDate: '2026-05-21',
        lines: [{ itemCode: 'A001', estimatedUnitPrice: 1 }],
      }).success,
    ).toBe(false);

    expect(
      createPurchaseRequestSchema.safeParse({
        requiredDate: '2026-05-21',
        lines: [{ itemCode: 'A001', quantity: 1 }],
      }).success,
    ).toBe(false);
  });

  it('requires at least one line item', () => {
    const invalid = createPurchaseRequestSchema.safeParse({
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
