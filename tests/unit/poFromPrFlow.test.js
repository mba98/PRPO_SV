import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findById: vi.fn(),
  updateOne: vi.fn(),
  createPO: vi.fn(),
  poCreate: vi.fn(),
  nextNumber: vi.fn(),
  logHistory: vi.fn(),
  notify: vi.fn(),
}));

vi.mock('@/lib/mongodb', () => ({ connectDB: vi.fn().mockResolvedValue(true) }));

vi.mock('@/models/PurchaseRequest.js', () => ({
  default: {
    findById: mocks.findById,
    updateOne: mocks.updateOne,
  },
}));

function buildPrQuery() {
  const pr = makePr();
  return {
    lean: vi.fn().mockResolvedValue({
      _id: { toString: () => 'prid1' },
      portalPRNumber: 'PR-20260521-0001',
      status: 'Fully Ordered',
      sapPODocEntry: 501,
      sapPODocNum: '9001',
    }),
    then(onFulfilled, onRejected) {
      return Promise.resolve(pr).then(onFulfilled, onRejected);
    },
  };
}

vi.mock('@/models/PurchaseOrder.js', () => ({
  default: {
    findOne: vi.fn(() => ({
      lean: vi.fn().mockResolvedValue(null),
      sort: vi.fn(() => ({ lean: vi.fn().mockResolvedValue(null) })),
    })),
    findById: vi.fn(() => ({
      lean: vi.fn().mockResolvedValue({
        _id: { toString: () => 'poid1' },
        portalPONumber: 'PO-20260521-0001',
        sapPODocEntry: 501,
        sapPODocNum: '9001',
      }),
    })),
    create: mocks.poCreate,
    updateOne: mocks.updateOne,
    deleteOne: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('@/models/SapIntegrationLog.js', () => ({
  default: { create: vi.fn().mockResolvedValue(true) },
}));

vi.mock('@/models/SystemSettings.js', () => ({
  default: {
    findOne: vi.fn(() => ({ lean: vi.fn().mockResolvedValue(null) })),
  },
}));

vi.mock('@/lib/sapServiceLayer.js', () => ({
  createPO: mocks.createPO,
}));

vi.mock('@/lib/numbering.js', () => ({
  nextNumber: mocks.nextNumber,
}));

vi.mock('@/lib/auditHistory.js', () => ({
  logApprovalHistory: mocks.logHistory,
}));

vi.mock('@/lib/emailNotify.js', () => ({
  notifyEvent: mocks.notify,
}));

import PurchaseOrder from '@/models/PurchaseOrder.js';
import { createSapPoFromPr, findDuplicatePo } from '@/lib/sap/poFromPrSap';

function mockFindOneResult(doc) {
  PurchaseOrder.findOne.mockImplementation(() => ({
    lean: vi.fn().mockResolvedValue(doc),
    sort: vi.fn(() => ({ lean: vi.fn().mockResolvedValue(doc) })),
  }));
}

function makePr(overrides = {}) {
  return {
    _id: { toString: () => 'prid1', equals: () => true },
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
            return other === this || other?.toString?.() === 'line1';
          },
        },
        itemCode: 'ITEM1',
        quantity: 2,
        orderedQty: 0,
        vendor: 'VENDOR1',
        estimatedUnitPrice: 50,
      },
    ],
    toObject() {
      return { ...this, lines: this.lines };
    },
    save: vi.fn(),
  };
}

describe('PR → PO SAP flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.nextNumber.mockResolvedValue('PO-20260521-0001');
    mocks.poCreate.mockImplementation((data) =>
      Promise.resolve({ _id: { toString: () => 'poid1' }, ...data }),
    );
    mocks.createPO.mockResolvedValue({ DocEntry: 501, DocNum: 9001 });
    mocks.findById.mockImplementation(() => buildPrQuery());
    mockFindOneResult(null);
  });

  it('rejects duplicate PO for same PR and vendor', async () => {
    mockFindOneResult({
      portalPONumber: 'PO-1',
      sapPODocEntry: 1,
      sapPODocNum: '1',
    });
    const dup = await findDuplicatePo('prid1', 'VENDOR1');
    expect(dup).toBeTruthy();
    const result = await createSapPoFromPr('prid1', { _id: 'u1' }, { vendor: 'VENDOR1' });
    expect(result.error).toBe('DUPLICATE_PO');
    expect(mocks.createPO).not.toHaveBeenCalled();
  });

  it('creates SAP PO and updates PR with sapPODocEntry', async () => {
    const result = await createSapPoFromPr('prid1', { _id: 'u1', id: 'u1' }, { vendor: 'VENDOR1' });
    expect(result.success).toBe(true);
    expect(mocks.createPO).toHaveBeenCalled();
    const payload = mocks.createPO.mock.calls[0][0];
    expect(payload.CardCode).toBe('VENDOR1');
    expect(payload.DocumentLines[0].BaseEntry).toBe(99);
    expect(mocks.logHistory).toHaveBeenCalled();
    expect(mocks.notify).toHaveBeenCalledWith(
      'po.sap.created',
      expect.objectContaining({ subject: expect.stringContaining('PO') }),
    );
    const prUpdate = mocks.updateOne.mock.calls.find(
      (c) => c[0]?._id === 'prid1' && c[1]?.$set?.sapPODocEntry === 501,
    );
    expect(prUpdate).toBeTruthy();
  });

  it('returns SAP_FAILED and logs on Service Layer error', async () => {
    mocks.createPO.mockRejectedValue({
      message: 'Vendor not found',
      responseBody: { error: { message: { value: 'Vendor not found' } } },
    });
    const result = await createSapPoFromPr('prid1', { _id: 'u1' }, { vendor: 'VENDOR1' });
    expect(result.error).toBe('SAP_FAILED');
    expect(mocks.notify).toHaveBeenCalledWith('po.sap.failed', expect.any(Object));
  });
});
