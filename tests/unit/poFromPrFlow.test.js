import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findById: vi.fn(),
  poCreate: vi.fn(),
  logHistory: vi.fn(),
  notify: vi.fn(),
  getSteps: vi.fn(),
}));

vi.mock('@/lib/mongodb', () => ({ connectDB: vi.fn().mockResolvedValue(true) }));

vi.mock('@/models/PurchaseRequest.js', () => ({
  default: { findById: mocks.findById },
}));

vi.mock('@/models/PurchaseOrder.js', () => ({
  default: {
    findOne: vi.fn(() => ({ lean: vi.fn().mockResolvedValue(null) })),
    findById: vi.fn(() => ({
      lean: vi.fn().mockResolvedValue({
        _id: { toString: () => 'poid1' },
        portalPONumber: 'PO-20260521-0001',
        status: 'Pending Project Manager Approval',
        vendor: 'VENDOR1',
      }),
    })),
    create: mocks.poCreate,
  },
}));

vi.mock('@/lib/numbering.js', () => ({
  nextNumber: vi.fn().mockResolvedValue('PO-20260521-0001'),
}));

vi.mock('@/lib/auditHistory.js', () => ({
  logApprovalHistory: mocks.logHistory,
}));

vi.mock('@/lib/emailNotify.js', () => ({
  notifyEvent: mocks.notify,
  notifyWorkflowEmailSafe: mocks.notify,
}));

vi.mock('@/lib/approvalEngine.js', () => ({
  getApprovalSteps: mocks.getSteps,
  getInitialSubmitState: vi.fn(() => ({
    currentApprovalStep: 1,
    status: 'Pending Project Manager Approval',
  })),
}));

import { createPortalPoFromPr, findDuplicatePo } from '@/lib/sap/poFromPrSap';

function makePr() {
  return {
    _id: { toString: () => 'prid1' },
    portalPRNumber: 'PR-20260521-0001',
    sapPRDocEntry: 99,
    sapPRDocNum: '200',
    status: 'Created in SAP',
    department: 'Ops',
    requester: 'user1',
    warehouse: 'WH1',
    requiredDate: new Date(),
    lines: [
      {
        _id: {
          toString: () => 'line1',
          equals(other) {
            return other?.toString?.() === 'line1';
          },
        },
        itemCode: 'ITEM1',
        quantity: 2,
        orderedQty: 0,
        vendor: 'VENDOR1',
        estimatedUnitPrice: 50,
        uomCode: 'PCS',
      },
    ],
    toObject() {
      return { ...this, lines: this.lines };
    },
    save: vi.fn().mockResolvedValue(true),
  };
}

describe('portal PO from PR', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const PurchaseOrder = (await import('@/models/PurchaseOrder.js')).default;
    PurchaseOrder.findOne.mockImplementation(() => ({
      lean: vi.fn().mockResolvedValue(null),
    }));
    mocks.getSteps.mockResolvedValue([
      { stepOrder: 1, requiredPermission: 'po.approve.pm', stepName: 'PM' },
      { stepOrder: 2, requiredPermission: 'po.approve.finance', stepName: 'Finance' },
    ]);
    mocks.findById.mockResolvedValue(makePr());
    mocks.poCreate.mockImplementation((data) =>
      Promise.resolve({
        _id: { toString: () => 'poid1' },
        ...data,
        status: data.status,
      }),
    );
  });

  it('rejects duplicate portal PO per PR and vendor', async () => {
    const PurchaseOrder = (await import('@/models/PurchaseOrder.js')).default;
    PurchaseOrder.findOne.mockImplementation(() => ({
      lean: vi.fn().mockResolvedValue({
        _id: { toString: () => 'existing' },
        portalPONumber: 'PO-EXISTING',
      }),
    }));
    const result = await createPortalPoFromPr('prid1', { _id: 'u1' }, { vendor: 'VENDOR1' });
    expect(result.error).toBe('DUPLICATE_PO');
    expect(mocks.poCreate).not.toHaveBeenCalled();
  });

  it('creates portal PO with Pending PM Approval (no SAP)', async () => {
    const result = await createPortalPoFromPr('prid1', { _id: 'u1', roleName: 'Procurement' }, {
      vendor: 'VENDOR1',
    });
    expect(result.success).toBe(true);
    expect(mocks.poCreate).toHaveBeenCalled();
    const created = mocks.poCreate.mock.calls[0][0];
    expect(created.docCurrency).toBe('USD');
    expect(created.status).toBe('Pending Project Manager Approval');
    expect(created.currentApprovalStep).toBe(1);
    expect(created.relatedSAPPRDocEntry).toBe(99);
    expect(created.lines[0].uomCode).toBe('PCS');
    expect(created.relatedSAPPRDocNum).toBe('200');
    expect(created.remarks).toContain('PR-20260521-0001');
    expect(mocks.notify).toHaveBeenCalledWith(
      'po.created',
      expect.objectContaining({ portalPONumber: 'PO-20260521-0001' }),
      expect.objectContaining({ documentType: 'PO' }),
    );
    expect(mocks.logHistory).toHaveBeenCalled();
    const pr = await mocks.findById.mock.results[0]?.value;
    expect(pr.save).toHaveBeenCalled();
    expect(pr.relatedPortalPONumber).toBe('PO-20260521-0001');
    expect(pr.status).toBe('Partially Ordered');
  });

  it('saves docCurrency and omits docRate for IQD on create from PR', async () => {
    const result = await createPortalPoFromPr('prid1', { _id: 'u1' }, {
      vendor: 'VENDOR1',
      docCurrency: 'IQD',
      docRate: 1350,
    });
    expect(result.success).toBe(true);
    const created = mocks.poCreate.mock.calls[0][0];
    expect(created.docCurrency).toBe('IQD');
    expect(created.docRate).toBeUndefined();
  });

  it('rejects PRs not in Created in SAP status', async () => {
    const pr = makePr();
    pr.status = 'Approved';
    mocks.findById.mockResolvedValue(pr);
    const result = await createPortalPoFromPr('prid1', { _id: 'u1' }, { vendor: 'VENDOR1' });
    expect(result.error).toBe('INVALID_STATUS');
    expect(mocks.poCreate).not.toHaveBeenCalled();
  });
});
