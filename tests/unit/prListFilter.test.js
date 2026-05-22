import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildListFilter } from '@/lib/purchaseRequestsService';

const getApprovalSteps = vi.fn();

vi.mock('@/lib/approvalEngine.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getApprovalSteps: (...args) => getApprovalSteps(...args),
  };
});

const STEPS = [
  { stepOrder: 1, requiredPermission: 'pr.approve.whs' },
  { stepOrder: 2, requiredPermission: 'pr.approve.pm' },
];

describe('buildListFilter', () => {
  beforeEach(() => {
    getApprovalSteps.mockResolvedValue(STEPS);
  });

  it('shows failed SAP PRs to view.all on failed-sap tab', async () => {
    const filter = await buildListFilter(
      { _id: '1', permissions: ['view.all'] },
      { tab: 'failed-sap', searchParams: new URLSearchParams() },
    );
    expect(filter.status).toBe('Failed to Create in SAP');
    expect(filter.requester).toBeUndefined();
  });

  it('shows failed SAP PRs to original requester on my tab', async () => {
    const filter = await buildListFilter(
      { _id: 'req1', permissions: ['pr.create'] },
      { tab: 'my', searchParams: new URLSearchParams() },
    );
    expect(filter.requester).toEqual('req1');
    expect(filter.status).toBeUndefined();
  });

  it('shows post-approval PRs to project manager without requester filter', async () => {
    const filter = await buildListFilter(
      {
        _id: 'pm1',
        permissions: [],
        role: { permissions: ['pr.approve.pm'] },
      },
      { tab: 'approved', searchParams: new URLSearchParams() },
    );
    expect(filter.status.$in).toContain('Failed to Create in SAP');
    expect(filter.requester).toBeUndefined();
  });

  it('limits post-approval tab to own PRs for requester role', async () => {
    const filter = await buildListFilter(
      { _id: 'req1', permissions: ['pr.create'] },
      { tab: 'approved', searchParams: new URLSearchParams() },
    );
    expect(filter.requester).toEqual('req1');
    expect(filter.status.$in).toContain('Failed to Create in SAP');
  });
});
