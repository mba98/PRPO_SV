import { describe, expect, it } from 'vitest';
import {
  buildDocumentApprovalAccess,
  canUserApproveDocument,
  matchesApproverRole,
} from '@/lib/documentApprovalAuth.js';

const PR_STEPS = [
  {
    stepOrder: 1,
    stepName: 'Warehouse Approval',
    requiredPermission: 'pr.approve.whs',
    isActive: true,
    approverRole: { _id: 'role-whs', name: 'WHS Approver' },
  },
  {
    stepOrder: 2,
    stepName: 'Project Manager Approval',
    requiredPermission: 'pr.approve.pm',
    isActive: true,
    approverRole: { _id: 'role-pm', name: 'Project Manager' },
  },
];

const WHS_USER = {
  _id: 'user-whs',
  permissions: ['pr.approve.whs'],
  role: { _id: 'role-whs', name: 'WHS Approver' },
  roleName: 'WHS Approver',
};

const REQUESTER = {
  _id: 'user-req',
  permissions: ['pr.create'],
  role: { _id: 'role-req', name: 'Requester' },
  roleName: 'Requester',
};

describe('documentApprovalAuth', () => {
  it('allows WHS approver on pending warehouse PR step', () => {
    const pr = {
      id: 'pr1',
      status: 'Pending Warehouse Approval',
      currentApprovalStep: 1,
    };

    expect(
      canUserApproveDocument({
        documentType: 'PR',
        document: pr,
        user: WHS_USER,
        approvalSteps: PR_STEPS,
        logDiagnostics: false,
      }),
    ).toBe(true);

    const access = buildDocumentApprovalAccess({
      documentType: 'PR',
      document: pr,
      user: WHS_USER,
      approvalSteps: PR_STEPS,
    });
    expect(access.canApprove).toBe(true);
    expect(access.approveUrl).toBe('/purchase-requests/pr1/approve');
  });

  it('denies requester on pending warehouse PR step', () => {
    const pr = {
      id: 'pr1',
      status: 'Pending Warehouse Approval',
      currentApprovalStep: 1,
    };

    expect(
      canUserApproveDocument({
        documentType: 'PR',
        document: pr,
        user: REQUESTER,
        approvalSteps: PR_STEPS,
        logDiagnostics: false,
      }),
    ).toBe(false);
  });

  it('denies WHS approver when PR status does not match matrix step', () => {
    const pr = {
      id: 'pr1',
      status: 'Pending Project Manager Approval',
      currentApprovalStep: 2,
    };

    expect(
      canUserApproveDocument({
        documentType: 'PR',
        document: pr,
        user: WHS_USER,
        approvalSteps: PR_STEPS,
        logDiagnostics: false,
      }),
    ).toBe(false);
  });

  it('matches approver role by id or name', () => {
    expect(matchesApproverRole(WHS_USER, PR_STEPS[0])).toBe(true);
    expect(
      matchesApproverRole(
        { permissions: ['pr.approve.whs'], role: { _id: 'other', name: 'WHS Approver' } },
        PR_STEPS[0],
      ),
    ).toBe(true);
    expect(matchesApproverRole(REQUESTER, PR_STEPS[0])).toBe(false);
  });
});
