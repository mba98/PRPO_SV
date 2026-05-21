import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/lib/mongodb', () => ({ connectDB: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/numbering.js', () => ({ nextNumber: vi.fn().mockResolvedValue('APRI-20260521-0001') }));
vi.mock('@/lib/auditHistory.js', () => ({ logApprovalHistory: vi.fn().mockResolvedValue({}) }));
vi.mock('@/lib/sap/apriSap.js', () => ({
  createSapApReserveInvoice: vi.fn().mockResolvedValue({ success: true }),
}));

import APReserveInvoice from '@/models/APReserveInvoice.js';
import PurchaseOrder from '@/models/PurchaseOrder.js';
import { createApriFromPo } from '@/lib/apReserveInvoicesService';

describe('APRI duplicate guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('blocks when APRI already created in SAP for PO', async () => {
    vi.spyOn(PurchaseOrder, 'findById').mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: 'po1',
        portalPONumber: 'PO-1',
        status: 'Created in SAP',
        sapPODocEntry: 10,
        sapResponse: { DocumentLines: [{ ItemCode: 'A', LineNum: 0 }] },
        lines: [{ _id: 'l1', itemCode: 'A', quantity: 1 }],
        vendor: 'V1',
      }),
    });
    vi.spyOn(APReserveInvoice, 'findOne').mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: 'apri1',
        sapAPDocEntry: 200,
        status: 'Created in SAP',
      }),
    });

    const result = await createApriFromPo('po1', { _id: 'u1', id: 'u1' });
    expect(result.error).toBe('DUPLICATE_APRI');
  });
});
