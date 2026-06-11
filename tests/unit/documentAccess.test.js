import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prFindById: vi.fn(),
  poFindById: vi.fn(),
  apriFindById: vi.fn(),
}));

vi.mock('@/lib/mongodb', () => ({ connectDB: vi.fn().mockResolvedValue(true) }));

vi.mock('@/models/PurchaseRequest.js', () => ({
  default: { findById: (id) => mocks.prFindById(id) },
}));
vi.mock('@/models/PurchaseOrder.js', () => ({
  default: { findById: (id) => mocks.poFindById(id) },
}));
vi.mock('@/models/APReserveInvoice.js', () => ({
  default: { findById: (id) => mocks.apriFindById(id) },
}));

vi.mock('@/lib/approvalEngine.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getApprovalSteps: vi.fn().mockResolvedValue([
      {
        stepOrder: 1,
        stepName: 'Warehouse Approval',
        requiredPermission: 'pr.approve.whs',
        pendingStatus: 'Pending Warehouse Approval',
      },
    ]),
  };
});

import { assertCanAccessDocument } from '@/lib/documentAccess.js';

const PR_ID = '64b8c1a52f5b1b2c3d4e5f60';
const PO_ID = '64b8c1a52f5b1b2c3d4e5f61';
const APRI_ID = '64b8c1a52f5b1b2c3d4e5f62';

function lean(value) {
  return { lean: () => Promise.resolve(value) };
}

describe('assertCanAccessDocument', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws INVALID_TYPE for unknown documentType', async () => {
    await expect(
      assertCanAccessDocument({ _id: 'u1' }, 'INVOICE', PR_ID),
    ).rejects.toMatchObject({ code: 'INVALID_TYPE' });
  });

  it('throws INVALID_ID for non-ObjectId documentId', async () => {
    await expect(
      assertCanAccessDocument({ _id: 'u1' }, 'PR', 'not-an-id'),
    ).rejects.toMatchObject({ code: 'INVALID_ID' });
  });

  it('throws NOT_FOUND when the document is missing', async () => {
    mocks.prFindById.mockReturnValueOnce(lean(null));
    await expect(
      assertCanAccessDocument({ _id: 'u1', permissions: ['view.all'] }, 'PR', PR_ID),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('allows the PR requester to access their own PR', async () => {
    mocks.prFindById.mockReturnValueOnce(lean({ _id: PR_ID, requester: 'u1' }));
    await expect(
      assertCanAccessDocument({ _id: 'u1', permissions: [] }, 'PR', PR_ID),
    ).resolves.toMatchObject({ requester: 'u1' });
  });

  it('allows pr.approve.pm users to access any PR', async () => {
    mocks.prFindById.mockReturnValueOnce(lean({ _id: PR_ID, requester: 'someoneElse' }));
    await expect(
      assertCanAccessDocument(
        { _id: 'u2', permissions: ['pr.approve.pm'] },
        'PR',
        PR_ID,
      ),
    ).resolves.toBeTruthy();
  });

  it('forbids unrelated users without view.all from accessing a PR', async () => {
    mocks.prFindById.mockReturnValueOnce(lean({ _id: PR_ID, requester: 'someoneElse' }));
    await expect(
      assertCanAccessDocument({ _id: 'u3', permissions: ['pr.create'] }, 'PR', PR_ID),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('allows po.approve.om users to access a PO pending Operation Manager approval', async () => {
    mocks.poFindById.mockReturnValueOnce(
      lean({
        _id: PO_ID,
        requester: 'someoneElse',
        status: 'pending_om',
      }),
    );
    await expect(
      assertCanAccessDocument(
        { _id: 'u4b', permissions: ['po.approve.om'] },
        'PO',
        PO_ID,
      ),
    ).resolves.toBeTruthy();
  });

  it('allows po.approve.finance users to access a PO pending Finance approval', async () => {
    mocks.poFindById.mockReturnValueOnce(
      lean({
        _id: PO_ID,
        requester: 'someoneElse',
        status: 'Pending Finance Approval',
      }),
    );
    await expect(
      assertCanAccessDocument(
        { _id: 'u4', permissions: ['po.approve.finance'] },
        'PO',
        PO_ID,
      ),
    ).resolves.toBeTruthy();
  });

  it('allows apinvoice.create users to access their own APRI', async () => {
    mocks.apriFindById.mockReturnValueOnce(
      lean({
        _id: APRI_ID,
        createdBy: 'u5',
        status: 'Pending Warehouse Approval',
        currentApprovalStep: 1,
      }),
    );
    await expect(
      assertCanAccessDocument(
        { _id: 'u5', permissions: ['apinvoice.create'] },
        'APRI',
        APRI_ID,
      ),
    ).resolves.toBeTruthy();
  });

  it('allows pr.approve.whs users to access APRI pending warehouse approval', async () => {
    mocks.apriFindById.mockReturnValueOnce(
      lean({
        _id: APRI_ID,
        createdBy: 'someoneElse',
        status: 'Pending Warehouse Approval',
        currentApprovalStep: 1,
      }),
    );
    await expect(
      assertCanAccessDocument(
        { _id: 'u6', permissions: ['pr.approve.whs'] },
        'APRI',
        APRI_ID,
      ),
    ).resolves.toBeTruthy();
  });

  it('forbids users without matrix or procurement access from APRI', async () => {
    mocks.apriFindById.mockReturnValueOnce(
      lean({
        _id: APRI_ID,
        createdBy: 'someoneElse',
        status: 'Pending Warehouse Approval',
        currentApprovalStep: 1,
      }),
    );
    await expect(
      assertCanAccessDocument(
        { _id: 'u7', permissions: ['pr.create'] },
        'APRI',
        APRI_ID,
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
