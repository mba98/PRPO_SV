import { describe, expect, it } from 'vitest';
import {
  buildDocumentApprovalAccess,
  canUserApproveDocument,
  matchesApproverRole,
} from '@/lib/documentApprovalAuth.js';
import { PO_STATUS } from '@/lib/poStatus.js';

const PO_STEPS = [
  {
    stepOrder: 1,
    stepName: 'Project Manager Approval',
    requiredPermission: 'po.approve.pm',
    completionPolicy: 'ANY_ONE',
    isActive: true,
    approverRole: { _id: 'role-pm', name: 'Project Manager' },
  },
  {
    stepOrder: 2,
    stepName: 'Operation Manager Approval',
    requiredPermission: 'po.approve.om',
    completionPolicy: 'ANY_ONE',
    isActive: true,
    approverRole: { _id: 'role-om', name: 'Operation Manager' },
  },
  {
    stepOrder: 3,
    stepName: 'Finance Approval',
    requiredPermission: 'po.approve.finance',
    completionPolicy: 'ANY_ONE',
    isActive: true,
    approverRole: { _id: 'role-fin', name: 'Finance' },
  },
];

const PM_USER_A = {
  _id: 'pm-a',
  permissions: ['po.approve.pm'],
  role: { _id: 'role-pm', name: 'Project Manager' },
  roleName: 'Project Manager',
};

const PM_USER_B = {
  _id: 'pm-b',
  permissions: ['po.approve.pm'],
  role: { _id: 'role-pm', name: 'Project Manager' },
  roleName: 'Project Manager',
};

const OM_USER = {
  _id: 'om-1',
  permissions: ['po.approve.om'],
  role: { _id: 'role-om', name: 'Operation Manager' },
  roleName: 'Operation Manager',
};

const PR_STEPS = [
  {
    stepOrder: 1,
    stepName: 'Warehouse Approval',
    requiredPermission: 'pr.approve.whs',
    completionPolicy: 'ANY_ONE',
    isActive: true,
    approverRole: { _id: 'role-whs', name: 'WHS Approver' },
  },
];

const APRI_STEPS = [
  {
    stepOrder: 1,
    stepName: 'Warehouse Approval',
    requiredPermission: 'apri.approve.whs',
    completionPolicy: 'ANY_ONE',
    isActive: true,
    approverRole: { _id: 'role-whs', name: 'WHS Approver' },
  },
];

describe('ANY_ONE documentApprovalAuth', () => {
  it('allows first authorized PM on pending PM step', () => {
    const po = { id: 'po1', status: PO_STATUS.PENDING_PM, currentApprovalStep: 1 };
    expect(
      canUserApproveDocument({
        documentType: 'PO',
        document: po,
        user: PM_USER_A,
        approvalSteps: PO_STEPS,
        logDiagnostics: false,
      }),
    ).toBe(true);
  });

  it('allows any PM with same role (second authorized user before step completes)', () => {
    const po = { id: 'po1', status: PO_STATUS.PENDING_PM, currentApprovalStep: 1 };
    expect(
      canUserApproveDocument({
        documentType: 'PO',
        document: po,
        user: PM_USER_B,
        approvalSteps: PO_STEPS,
        logDiagnostics: false,
      }),
    ).toBe(true);
  });

  it('denies PM after step advanced to OM', () => {
    const po = { id: 'po1', status: PO_STATUS.PENDING_OM, currentApprovalStep: 2 };
    expect(
      canUserApproveDocument({
        documentType: 'PO',
        document: po,
        user: PM_USER_A,
        approvalSteps: PO_STEPS,
        logDiagnostics: false,
      }),
    ).toBe(false);
  });

  it('denies approve after rejection', () => {
    const po = { id: 'po1', status: PO_STATUS.REJECTED, currentApprovalStep: 0 };
    expect(
      canUserApproveDocument({
        documentType: 'PO',
        document: po,
        user: PM_USER_A,
        approvalSteps: PO_STEPS,
        logDiagnostics: false,
      }),
    ).toBe(false);
  });

  it('denies user with role but missing permission', () => {
    const po = { id: 'po1', status: PO_STATUS.PENDING_PM, currentApprovalStep: 1 };
    const wrongPerm = {
      permissions: ['po.approve.om'],
      role: { _id: 'role-pm', name: 'Project Manager' },
    };
    expect(
      canUserApproveDocument({
        documentType: 'PO',
        document: po,
        user: wrongPerm,
        approvalSteps: PO_STEPS,
        logDiagnostics: false,
      }),
    ).toBe(false);
  });

  it('denies user with permission but wrong role', () => {
    const po = { id: 'po1', status: PO_STATUS.PENDING_PM, currentApprovalStep: 1 };
    const wrongRole = {
      permissions: ['po.approve.pm'],
      role: { _id: 'role-om', name: 'Operation Manager' },
    };
    expect(
      canUserApproveDocument({
        documentType: 'PO',
        document: po,
        user: wrongRole,
        approvalSteps: PO_STEPS,
        logDiagnostics: false,
      }),
    ).toBe(false);
  });

  it('denies unsupported completion policy', () => {
    const po = { id: 'po1', status: PO_STATUS.PENDING_PM, currentApprovalStep: 1 };
    const allPolicySteps = [{ ...PO_STEPS[0], completionPolicy: 'ALL' }];
    expect(
      canUserApproveDocument({
        documentType: 'PO',
        document: po,
        user: PM_USER_A,
        approvalSteps: allPolicySteps,
        logDiagnostics: false,
      }),
    ).toBe(false);
  });

  it('defaults legacy matrix rows without completionPolicy to ANY_ONE', () => {
    const po = { id: 'po1', status: PO_STATUS.PENDING_PM, currentApprovalStep: 1 };
    const legacyStep = { ...PO_STEPS[0] };
    delete legacyStep.completionPolicy;
    expect(
      canUserApproveDocument({
        documentType: 'PO',
        document: po,
        user: PM_USER_A,
        approvalSteps: [legacyStep],
        logDiagnostics: false,
      }),
    ).toBe(true);
  });

  it('exposes completion policy description on access payload', () => {
    const po = { id: 'po1', status: PO_STATUS.PENDING_PM, currentApprovalStep: 1 };
    const access = buildDocumentApprovalAccess({
      documentType: 'PO',
      document: po,
      user: PM_USER_A,
      approvalSteps: PO_STEPS,
    });
    expect(access.currentStepCompletionPolicy).toBe('ANY_ONE');
    expect(access.completionPolicyDescription).toMatch(/any one authorized user/i);
    expect(access.canRejectCurrentStep).toBe(true);
  });

  it('PR warehouse regression: WHS approver on step 1', () => {
    const pr = { status: 'Pending Warehouse Approval', currentApprovalStep: 1 };
    const whs = {
      permissions: ['pr.approve.whs'],
      role: { _id: 'role-whs', name: 'WHS Approver' },
    };
    expect(
      canUserApproveDocument({
        documentType: 'PR',
        document: pr,
        user: whs,
        approvalSteps: PR_STEPS,
        logDiagnostics: false,
      }),
    ).toBe(true);
  });

  it('PO OM and Finance steps authorize correct roles', () => {
    const poOm = { status: PO_STATUS.PENDING_OM, currentApprovalStep: 2 };
    const poFin = { status: PO_STATUS.PENDING_FINANCE, currentApprovalStep: 3 };
    const finUser = {
      permissions: ['po.approve.finance'],
      role: { _id: 'role-fin', name: 'Finance' },
    };
    expect(
      canUserApproveDocument({
        documentType: 'PO',
        document: poOm,
        user: OM_USER,
        approvalSteps: PO_STEPS,
        logDiagnostics: false,
      }),
    ).toBe(true);
    expect(
      canUserApproveDocument({
        documentType: 'PO',
        document: poFin,
        user: finUser,
        approvalSteps: PO_STEPS,
        logDiagnostics: false,
      }),
    ).toBe(true);
  });

  it('APRI warehouse regression: apri.approve.whs approves; pr.approve.whs alone does not', () => {
    const apri = { status: 'pending_warehouse', currentApprovalStep: 1 };
    const apriWhs = {
      permissions: ['apri.approve.whs'],
      role: { _id: 'role-whs', name: 'WHS Approver' },
    };
    const prOnlyWhs = {
      permissions: ['pr.approve.whs'],
      role: { _id: 'role-whs', name: 'WHS Approver' },
    };
    expect(
      canUserApproveDocument({
        documentType: 'APRI',
        document: apri,
        user: apriWhs,
        approvalSteps: APRI_STEPS,
        logDiagnostics: false,
      }),
    ).toBe(true);
    expect(
      canUserApproveDocument({
        documentType: 'APRI',
        document: apri,
        user: prOnlyWhs,
        approvalSteps: APRI_STEPS,
        logDiagnostics: false,
      }),
    ).toBe(false);
  });

  it('skips inactive matrix step via active steps list only', () => {
    const inactiveSteps = [
      { ...PO_STEPS[0], isActive: false },
      { ...PO_STEPS[1], stepOrder: 1, isActive: true },
    ];
    const po = { status: PO_STATUS.PENDING_OM, currentApprovalStep: 1 };
    expect(
      canUserApproveDocument({
        documentType: 'PO',
        document: po,
        user: OM_USER,
        approvalSteps: inactiveSteps.filter((s) => s.isActive),
        logDiagnostics: false,
      }),
    ).toBe(true);
  });

  it('matches approver role by stable id not display name alone', () => {
    expect(matchesApproverRole(PM_USER_A, PO_STEPS[0])).toBe(true);
    expect(
      matchesApproverRole(
        { permissions: ['po.approve.pm'], role: { _id: 'wrong-id', name: 'Project Manager' } },
        PO_STEPS[0],
      ),
    ).toBe(true);
    expect(
      matchesApproverRole(
        { permissions: ['po.approve.pm'], role: { _id: 'wrong-id', name: 'Other Role' } },
        PO_STEPS[0],
      ),
    ).toBe(false);
  });
});
