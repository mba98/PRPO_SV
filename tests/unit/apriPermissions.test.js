import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  APRI_STEPS: [
    {
      stepOrder: 1,
      stepName: 'Warehouse Approval',
      requiredPermission: 'pr.approve.whs',
      pendingStatus: 'Pending Warehouse Approval',
    },
  ],
}));

vi.mock('@/lib/approvalEngine.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getApprovalSteps: vi.fn().mockResolvedValue(mocks.APRI_STEPS),
  };
});

import {
  buildApriListAccessFilter,
  buildApriPendingApprovalFilter,
  userCanViewApriDocument,
} from '@/lib/apriPermissions.js';
import { userIsApriMatrixApprover } from '@/lib/permissions.js';

const WHS_USER = { _id: 'whs1', permissions: ['pr.approve.whs'] };
const PROC_USER = { _id: 'proc1', permissions: ['apinvoice.create'] };
const OTHER_USER = { _id: 'other1', permissions: ['pr.create'] };

const PENDING_APRI = {
  _id: 'apri1',
  status: 'Pending Warehouse Approval',
  currentApprovalStep: 1,
  createdBy: 'proc1',
};

describe('apriPermissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('identifies matrix approvers from sync permission superset', () => {
    expect(userIsApriMatrixApprover(['pr.approve.whs'])).toBe(true);
    expect(userIsApriMatrixApprover(['apinvoice.create'])).toBe(false);
  });

  it('builds pending approval filter for WHS approver', async () => {
    const filter = await buildApriPendingApprovalFilter(WHS_USER);
    expect(filter.$or?.[0].currentApprovalStep).toBe(1);
    expect(filter.$or?.[0].status.$in).toContain('pending_warehouse');
    expect(filter.$or?.[0].status.$in).toContain('Pending Warehouse Approval');
  });

  it('includes pending APRI in list access for WHS approver', async () => {
    const filter = await buildApriListAccessFilter(WHS_USER);
    expect(filter.currentApprovalStep).toBe(1);
    expect(filter.status.$in).toContain('pending_warehouse');
  });

  it('includes own created APRI for procurement user', async () => {
    const filter = await buildApriListAccessFilter(PROC_USER);
    expect(filter).toEqual({ createdBy: 'proc1' });
  });

  it('denies list access for unrelated users', async () => {
    const filter = await buildApriListAccessFilter(OTHER_USER);
    expect(filter).toEqual({ _id: null });
  });

  it('allows WHS approver to view APRI at their pending step', async () => {
    expect(await userCanViewApriDocument(WHS_USER, PENDING_APRI)).toBe(true);
  });

  it('allows procurement to view their own APRI', async () => {
    expect(await userCanViewApriDocument(PROC_USER, PENDING_APRI)).toBe(true);
  });

  it('denies unrelated users from viewing pending APRI', async () => {
    expect(await userCanViewApriDocument(OTHER_USER, PENDING_APRI)).toBe(false);
  });
});
