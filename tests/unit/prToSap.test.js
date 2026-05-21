import { describe, expect, it, vi, beforeEach } from 'vitest';
import { mapPrToSap, resolveBranchId } from '@/lib/sap/mappers/prToSap';

describe('prToSap mapper', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it('resolves branch from map then env default', () => {
    expect(resolveBranchId('Sales', { Sales: 3 })).toBe(3);
    vi.stubEnv('SAP_DEFAULT_BRANCH_ID', '7');
    expect(resolveBranchId('Unknown', {})).toBe(7);
  });

  it('maps PR document to SAP payload shape', () => {
    const pr = {
      requesterEmail: 'user@example.com',
      department: 'IT',
      requiredDate: new Date('2026-05-21'),
      documentDate: new Date('2026-05-20'),
      remarks: 'Need laptops',
      warehouse: 'WH01',
      project: 'PRJ1',
      lines: [
        {
          itemCode: 'ITEM1',
          quantity: 2,
          warehouseCode: 'WH01',
          projectCode: 'PRJ1',
          costCenter: 'CC1',
          estimatedUnitPrice: 100,
          requiredDate: new Date('2026-05-25'),
        },
      ],
    };
    const payload = mapPrToSap(pr, { branchMap: { IT: 2 } });
    expect(payload.Requester).toBe('user@example.com');
    expect(payload.BPL_IDAssignedToInvoice).toBe(2);
    expect(payload.U_Department).toBe('IT');
    expect(payload.DocumentLines).toHaveLength(1);
    expect(payload.DocumentLines[0].ItemCode).toBe('ITEM1');
    expect(payload.DocumentLines[0].Quantity).toBe(2);
    expect(payload.ReqDate).toBe('2026-05-21');
  });
});
