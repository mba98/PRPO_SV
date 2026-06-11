import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findById: vi.fn(),
  logHistory: vi.fn(),
}));

vi.mock('@/lib/mongodb', () => ({ connectDB: vi.fn().mockResolvedValue(true) }));

vi.mock('@/models/PurchaseOrder.js', () => ({
  default: { findById: mocks.findById },
}));

vi.mock('@/lib/auditHistory.js', () => ({
  logApprovalHistory: mocks.logHistory,
  getApprovalHistory: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/lib/attachmentsService.js', () => ({
  listAttachments: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/lib/workflowSteps.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    loadPoWorkflow: vi.fn().mockResolvedValue([]),
  };
});

import { PO_EDIT_FORBIDDEN_MESSAGE } from '@/lib/poEditPermissions';
import { PO_STATUS } from '@/lib/poStatus';
import { updatePurchaseOrder } from '@/lib/purchaseOrdersService';
import { getApprovalHistory } from '@/lib/auditHistory';

function makePoDoc(overrides = {}) {
  const status = overrides.status ?? PO_STATUS.PENDING_PM;
  const line = {
    _id: 'lineid1',
    itemCode: 'ITEM1',
    quantity: 2,
    unitPrice: 50,
    sapPRBaseLine: 0,
    relatedPRLineId: 'prline1',
  };
  return {
    _id: { toString: () => 'poid1' },
    portalPONumber: 'PO-1',
    status,
    sapPODocEntry: overrides.sapPODocEntry ?? null,
    vendor: 'V1',
    remarks: 'old',
    lines: [line],
    __v: 0,
    toObject() {
      return { ...this, lines: this.lines };
    },
    markModified: vi.fn(),
    save: vi.fn().mockResolvedValue(true),
    populate: vi.fn().mockReturnValue({
      toObject: () => ({
        _id: { toString: () => 'poid1' },
        portalPONumber: 'PO-1',
        status,
        vendor: 'V1',
        lines: [line],
      }),
    }),
    ...overrides,
  };
}

describe('updatePurchaseOrder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.logHistory.mockResolvedValue(undefined);
  });

  it('allows editing while pending_pm before any approval', async () => {
    const po = makePoDoc();
    mocks.findById.mockResolvedValue(po);
    getApprovalHistory.mockResolvedValue([]);
    const user = { _id: 'u1', permissions: ['po.create'], roleName: 'Procurement' };
    await updatePurchaseOrder('poid1', { remarks: 'updated note', __v: 0 }, user);
    expect(po.save).toHaveBeenCalled();
    expect(po.remarks).toBe('updated note');
    expect(mocks.logHistory).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'Updated' }),
    );
  });

  it('rejects editing when Created in SAP', async () => {
    const po = makePoDoc({ status: PO_STATUS.CREATED_IN_SAP, sapPODocEntry: 100 });
    mocks.findById.mockResolvedValue(po);
    getApprovalHistory.mockResolvedValue([]);
    const user = { _id: 'u1', permissions: ['po.create'] };
    await expect(
      updatePurchaseOrder('poid1', { remarks: 'nope', __v: 0 }, user),
    ).rejects.toMatchObject({ code: 'FORBIDDEN', message: PO_EDIT_FORBIDDEN_MESSAGE });
    expect(po.save).not.toHaveBeenCalled();
  });

  it('rejects editing after PM approval on pending_om', async () => {
    const po = makePoDoc({ status: PO_STATUS.PENDING_OM });
    mocks.findById.mockResolvedValue(po);
    getApprovalHistory.mockResolvedValue([{ action: 'Approved', stepName: 'PM' }]);
    const user = { _id: 'u1', permissions: ['po.create'] };
    await expect(
      updatePurchaseOrder('poid1', { remarks: 'nope', __v: 0 }, user),
    ).rejects.toMatchObject({ code: 'FORBIDDEN', message: PO_EDIT_FORBIDDEN_MESSAGE });
    expect(po.save).not.toHaveBeenCalled();
  });
});
