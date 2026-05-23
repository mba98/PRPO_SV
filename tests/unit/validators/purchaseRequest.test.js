import { describe, expect, it } from 'vitest';
import {
  createPurchaseRequestSchema,
  approveRejectSchema,
  createSapItemSchema,
} from '@/lib/validators/purchaseRequest';

describe('purchaseRequest validators', () => {
  it('accepts the simplified payload with warehouseCode and optional vendor', () => {
    const valid = createPurchaseRequestSchema.safeParse({
      requiredDate: '2026-05-18',
      documentDate: '2026-05-18',
      dueDate: '2026-05-19',
      lines: [
        {
          itemCode: 'ALK00004SV',
          quantity: 3,
          estimatedUnitPrice: 200000,
          warehouseCode: 'RAN004',
          vendor: 'V000001',
        },
      ],
    });
    expect(valid.success).toBe(true);
    expect(valid.data.lines[0].warehouseCode).toBe('RAN004');
    expect(valid.data.lines[0].vendor).toBe('V000001');
  });

  it('accepts minimal simplified payload (requiredDate + item/quantity/unit price)', () => {
    const valid = createPurchaseRequestSchema.safeParse({
      requiredDate: '2026-05-21',
      lines: [{ itemCode: 'ALR00027SV', quantity: 100, estimatedUnitPrice: 2222000 }],
    });
    expect(valid.success).toBe(true);
  });

  it('does not require department/project/cost center', () => {
    const parsed = createPurchaseRequestSchema.safeParse({
      requiredDate: '2026-05-21',
      lines: [{ itemCode: 'A001', quantity: 2, estimatedUnitPrice: 50 }],
    });
    expect(parsed.success).toBe(true);
    expect(parsed.data.department).toBeUndefined();
    expect(parsed.data.project).toBeUndefined();
    expect(parsed.data.lines[0].costCenter).toBeUndefined();
  });

  it('accepts optional remarks and line remarks', () => {
    const parsed = createPurchaseRequestSchema.safeParse({
      requiredDate: '2026-05-21',
      remarks: 'Urgent',
      lines: [
        {
          itemCode: 'A001',
          quantity: 2,
          estimatedUnitPrice: 50,
          remarks: 'Line note',
        },
      ],
    });
    expect(parsed.success).toBe(true);
    expect(parsed.data.remarks).toBe('Urgent');
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
