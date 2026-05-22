import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildPrPendingApprovalFilter } from '@/lib/purchaseRequestsService';

const getApprovalSteps = vi.fn();

vi.mock('@/lib/mongodb', () => ({
  connectDB: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/approvalEngine.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getApprovalSteps: (...args) => getApprovalSteps(...args),
  };
});

const STEPS = [
  {
    stepOrder: 1,
    stepName: 'Warehouse Approval',
    requiredPermission: 'pr.approve.whs',
  },
  {
    stepOrder: 2,
    stepName: 'Project Manager Approval',
    requiredPermission: 'pr.approve.pm',
  },
];

describe('buildPrPendingApprovalFilter', () => {
  beforeEach(() => {
    getApprovalSteps.mockResolvedValue(STEPS);
  });

  it('returns PM step filter when role permissions include pr.approve.pm only', async () => {
    const filter = await buildPrPendingApprovalFilter({
      permissions: [],
      role: { permissions: ['pr.approve.pm'] },
    });
    expect(filter.$or).toEqual([
      {
        status: 'Pending Project Manager Approval',
        currentApprovalStep: 2,
      },
    ]);
  });

  it('returns all pending statuses for view.all', async () => {
    const filter = await buildPrPendingApprovalFilter({
      permissions: ['view.all'],
      role: { permissions: [] },
    });
    expect(filter.status.$in).toEqual([
      'Pending Warehouse Approval',
      'Pending Project Manager Approval',
    ]);
  });

  it('returns empty match when user has no approval permissions', async () => {
    const filter = await buildPrPendingApprovalFilter({
      permissions: ['pr.create'],
      role: { permissions: ['pr.create'] },
    });
    expect(filter).toEqual({ _id: null });
  });
});
