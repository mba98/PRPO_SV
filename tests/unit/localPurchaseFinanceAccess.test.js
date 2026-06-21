import { describe, expect, it } from 'vitest';
import {
  LP_STATUS,
  pendingLpStatusForStep,
} from '@/lib/localPurchaseStatus.js';
import {
  userCanViewLocalPurchase,
  userHasAnyLpApprovalPermission,
} from '@/lib/localPurchasePermissions.js';
import {
  assertUserCanApproveDocument,
  canUserApproveDocument,
} from '@/lib/documentApprovalAuth.js';
import { getStateAfterApproval } from '@/lib/approvalEngine.js';

const LP_STEPS = [
  {
    stepOrder: 1,
    stepName: 'Project Manager Approval',
    requiredPermission: 'lp.approve.pm',
    approverRole: { _id: 'role-pm', name: 'Project Manager' },
    completionPolicy: 'ANY_ONE',
    isActive: true,
  },
  {
    stepOrder: 2,
    stepName: 'Finance Approval',
    requiredPermission: 'lp.approve.finance',
    approverRole: { _id: 'role-fin', name: 'Finance' },
    completionPolicy: 'ANY_ONE',
    isActive: true,
  },
];

const FINANCE_USER = {
  _id: 'fin1',
  role: { _id: 'role-fin', name: 'Finance', permissions: ['lp.approve.finance'] },
  roleName: 'Finance',
  permissions: ['lp.approve.finance', 'po.approve.finance'],
};

const PM_USER = {
  _id: 'pm1',
  role: { _id: 'role-pm', name: 'Project Manager', permissions: ['lp.approve.pm'] },
  roleName: 'Project Manager',
  permissions: ['lp.approve.pm'],
};

const OTHER_USER = {
  _id: 'other1',
  role: { _id: 'role-req', name: 'Requester' },
  roleName: 'Requester',
  permissions: ['pr.create'],
};

function pendingFinanceDoc() {
  return {
    _id: 'lp1',
    status: LP_STATUS.PENDING_FINANCE,
    currentApprovalStep: 2,
    createdBy: 'proc1',
  };
}

describe('local purchase finance access', () => {
  it('finance with lp.approve.finance can view pending_finance when matrix step matches', () => {
    expect(userCanViewLocalPurchase(FINANCE_USER, pendingFinanceDoc(), LP_STEPS)).toBe(true);
  });

  it('finance can approve the finance step', () => {
    expect(
      canUserApproveDocument({
        documentType: 'LOCAL_PURCHASE',
        document: pendingFinanceDoc(),
        user: FINANCE_USER,
        approvalSteps: LP_STEPS,
        logDiagnostics: false,
      }),
    ).toBe(true);
  });

  it('finance approval completes the document locally', () => {
    const after = getStateAfterApproval(LP_STEPS, 2, 'LOCAL_PURCHASE');
    expect(after.isFinal).toBe(true);
    expect(after.status).toBe(LP_STATUS.COMPLETED);
    expect(after.currentApprovalStep).toBe(0);
  });

  it('finance can view completed documents after acting', () => {
    expect(
      userCanViewLocalPurchase(
        FINANCE_USER,
        {
          ...pendingFinanceDoc(),
          status: LP_STATUS.COMPLETED,
          currentApprovalStep: 0,
        },
        LP_STEPS,
      ),
    ).toBe(true);
  });

  it('finance can reject pending_finance documents', () => {
    expect(() =>
      assertUserCanApproveDocument({
        documentType: 'LOCAL_PURCHASE',
        document: pendingFinanceDoc(),
        user: FINANCE_USER,
        approvalSteps: LP_STEPS,
        action: 'reject',
      }),
    ).not.toThrow();
  });

  it('finance without lp.approve.finance cannot view pending_finance with matrix checks', () => {
    const user = {
      _id: 'fin-po-only',
      role: { _id: 'role-fin', name: 'Finance', permissions: ['po.approve.finance'] },
      roleName: 'Finance',
      permissions: ['po.approve.finance'],
    };
    expect(userCanViewLocalPurchase(user, pendingFinanceDoc(), LP_STEPS)).toBe(false);
  });

  it('permission with wrong role receives forbidden on approve', () => {
    const user = {
      _id: 'wrong-role',
      role: { _id: 'role-pm', name: 'Project Manager' },
      roleName: 'Project Manager',
      permissions: ['lp.approve.finance'],
    };
    expect(
      canUserApproveDocument({
        documentType: 'LOCAL_PURCHASE',
        document: pendingFinanceDoc(),
        user,
        approvalSteps: LP_STEPS,
        logDiagnostics: false,
      }),
    ).toBe(false);
  });

  it('role with missing permission receives forbidden on approve', () => {
    const user = {
      _id: 'fin-no-perm',
      role: { _id: 'role-fin', name: 'Finance' },
      roleName: 'Finance',
      permissions: ['po.approve.finance'],
    };
    expect(userCanViewLocalPurchase(user, pendingFinanceDoc(), LP_STEPS)).toBe(false);
    expect(
      canUserApproveDocument({
        documentType: 'LOCAL_PURCHASE',
        document: pendingFinanceDoc(),
        user,
        approvalSteps: LP_STEPS,
        logDiagnostics: false,
      }),
    ).toBe(false);
  });

  it('unrelated user receives forbidden on approve', () => {
    expect(userCanViewLocalPurchase(OTHER_USER, pendingFinanceDoc(), LP_STEPS)).toBe(false);
    expect(() =>
      assertUserCanApproveDocument({
        documentType: 'LOCAL_PURCHASE',
        document: pendingFinanceDoc(),
        user: OTHER_USER,
        approvalSteps: LP_STEPS,
      }),
    ).toThrow(/Finance step|authorized/i);
  });

  it('pm cannot approve finance step but can still view pending_pm documents', () => {
    const pendingPmDoc = {
      status: LP_STATUS.PENDING_PM,
      currentApprovalStep: 1,
      createdBy: 'proc1',
    };
    expect(userCanViewLocalPurchase(PM_USER, pendingPmDoc, LP_STEPS)).toBe(true);
    expect(
      canUserApproveDocument({
        documentType: 'LOCAL_PURCHASE',
        document: pendingFinanceDoc(),
        user: PM_USER,
        approvalSteps: LP_STEPS,
        logDiagnostics: false,
      }),
    ).toBe(false);
  });

  it('maps finance matrix step to pending_finance status', () => {
    expect(pendingLpStatusForStep(LP_STEPS[1])).toBe(LP_STATUS.PENDING_FINANCE);
  });

  it('finance can approve when status is pending_finance even if step pointer is stale', () => {
    const staleDoc = {
      ...pendingFinanceDoc(),
      currentApprovalStep: 1,
    };
    expect(
      canUserApproveDocument({
        documentType: 'LOCAL_PURCHASE',
        document: staleDoc,
        user: FINANCE_USER,
        approvalSteps: LP_STEPS,
        logDiagnostics: false,
      }),
    ).toBe(true);
    expect(userCanViewLocalPurchase(FINANCE_USER, staleDoc, LP_STEPS)).toBe(true);
  });

  it('does not treat po.approve.finance as local purchase approval permission', () => {
    expect(userHasAnyLpApprovalPermission(['po.approve.finance'])).toBe(false);
  });
});

describe('existing workflow permissions unchanged', () => {
  it('PR approval permissions remain separate from LP finance', () => {
    expect(userHasAnyLpApprovalPermission(['pr.approve.pm'])).toBe(false);
  });
});
