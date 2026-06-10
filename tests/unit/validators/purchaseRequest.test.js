import { describe, expect, it } from 'vitest';
import {
  createPurchaseRequestSchema,
  approveRejectSchema,
  createSapItemSchema,
} from '@/lib/validators/purchaseRequest';

describe('purchaseRequest validators', () => {
  it('accepts optional uomCode on lines', () => {
    const valid = createPurchaseRequestSchema.safeParse({
      requiredDate: '2026-05-21',
      lines: [
        {
          itemCode: 'A001',
          quantity: 2,
          estimatedUnitPrice: 50,
          uomCode: 'PCS',
        },
      ],
    });
    expect(valid.success).toBe(true);
    expect(valid.data.lines[0].uomCode).toBe('PCS');
  });

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

  it('requires ItemName for SAP item create', () => {
    expect(createSapItemSchema.safeParse({ ItemName: 'Item' }).success).toBe(true);
    expect(createSapItemSchema.safeParse({ ItemCode: 'X' }).success).toBe(false);
  });

  it('createSapItemSchema coerces numeric ItemGroup to string', () => {
    const result = createSapItemSchema.safeParse({
      ItemName: 'Widget',
      ItemGroup: 108,
      UgpEntry: 1,
      DefaultWarehouse: 'WH01',
      U_AcctCode: '4000',
      U_Company: 'ACME',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ItemGroup).toBe('108');
      expect(result.data.UgpEntry).toBe(1);
      expect(result.data.DefaultWarehouse).toBe('WH01');
    }
  });
});
