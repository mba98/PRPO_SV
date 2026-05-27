import { beforeEach, describe, expect, it, vi } from 'vitest';

const findResult = vi.hoisted(() => ({
  lean: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/lib/mongodb', () => ({ connectDB: vi.fn().mockResolvedValue(true) }));

vi.mock('@/models/PurchaseRequest.js', () => ({
  default: {
    find: vi.fn(() => ({
      populate: () => ({
        sort: () => ({
          limit: () => findResult,
        }),
      }),
    })),
  },
}));

import PurchaseRequest from '@/models/PurchaseRequest.js';
import { fetchPurchaseRequestsForExport } from '@/lib/purchaseRequestsService';

describe('export service', () => {
  beforeEach(() => {
    findResult.lean.mockResolvedValue([
      {
        _id: '1',
        portalPRNumber: 'PR-1',
        requester: { name: 'Alice' },
        lines: [],
      },
    ]);
    vi.mocked(PurchaseRequest.find).mockClear();
  });

  it('applies status filter from searchParams', async () => {
    const user = { _id: 'u1', permissions: ['view.all'] };
    const searchParams = new URLSearchParams('status=Approved&tab=all');
    await fetchPurchaseRequestsForExport(user, {
      searchParams,
      sort: 'createdAt',
      order: 'desc',
      limit: 100,
    });
    const filterArg = vi.mocked(PurchaseRequest.find).mock.calls[0][0];
    expect(filterArg.status).toBe('Approved');
  });

  it('scopes export to requester for non-admin', async () => {
    const user = { _id: 'u1', permissions: ['pr.create'] };
    const searchParams = new URLSearchParams('tab=my');
    await fetchPurchaseRequestsForExport(user, {
      searchParams,
      sort: 'createdAt',
      order: 'desc',
      limit: 100,
    });
    const filterArg = vi.mocked(PurchaseRequest.find).mock.calls[0][0];
    expect(filterArg.requester).toBe('u1');
  });
});
