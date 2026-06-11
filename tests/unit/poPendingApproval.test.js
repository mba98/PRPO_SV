import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildPoPendingApprovalFilter } from '@/lib/purchaseOrdersService';
import { PO_STATUS } from '@/lib/poStatus';

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

const PO_STEPS = [
  {
    stepOrder: 1,
    stepName: 'Project Manager Approval',
    requiredPermission: 'po.approve.pm',
  },
  {
    stepOrder: 2,
    stepName: 'Finance Approval',
    requiredPermission: 'po.approve.finance',
  },
];

describe('buildPoPendingApprovalFilter', () => {
  beforeEach(() => {
    getApprovalSteps.mockResolvedValue(PO_STEPS);
  });

  it('returns PM step filter when role permissions include po.approve.pm only', async () => {
    const filter = await buildPoPendingApprovalFilter({
      permissions: [],
      role: { permissions: ['po.approve.pm'] },
    });
    expect(filter.$or).toEqual([
      {
        status: {
          $in: expect.arrayContaining([
            PO_STATUS.PENDING_PM,
            'Pending Project Manager',
            'Pending Project Manager Approval',
          ]),
        },
        currentApprovalStep: 1,
      },
    ]);
  });

  it('returns all pending statuses for view.all', async () => {
    const filter = await buildPoPendingApprovalFilter({
      permissions: ['view.all'],
      role: { permissions: [] },
    });
    expect(filter.status.$in).toEqual(
      expect.arrayContaining([
        PO_STATUS.PENDING_PM,
        PO_STATUS.PENDING_FINANCE,
        'Pending Project Manager Approval',
        'Pending Finance Approval',
      ]),
    );
  });
});
