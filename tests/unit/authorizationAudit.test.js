import { describe, expect, it } from 'vitest';
import {
  buildDocumentApprovalAccess,
  canUserApproveDocument,
} from '@/lib/documentApprovalAuth.js';
import { canEditPurchaseOrder } from '@/lib/poEditPermissions.js';
import { canEditPurchaseRequest } from '@/lib/prEditPermissions.js';
import { userHasGlobalReadAccess } from '@/lib/permissionChecks.js';
import { getVisibleSettingsNav } from '@/lib/navigation.js';
import { canAccessSettingsPath } from '@/lib/settingsRoutePermissions.js';
import { canCreatePoFromPr } from '@/lib/poPermissions.js';
import { canRetrySapPurchaseRequest } from '@/lib/prPermissions.js';
import { userCanEditApriQuantities } from '@/lib/apReserveInvoicesService.js';
import { PO_STATUS } from '@/lib/poStatus.js';

const WHS_USER = {
  _id: 'u-whs',
  permissions: ['pr.view', 'pr.approve.whs', 'apri.view', 'apri.approve.whs'],
  role: { _id: 'role-whs', name: 'WHS Approver' },
  roleName: 'WHS Approver',
};

const PM_USER = {
  _id: 'u-pm',
  permissions: ['po.view', 'po.approve.pm'],
  role: { _id: 'role-pm', name: 'Project Manager' },
  roleName: 'Project Manager',
};

const OM_USER = {
  _id: 'u-om',
  permissions: ['po.view', 'po.approve.om'],
  role: { _id: 'role-om', name: 'Operation Manager' },
  roleName: 'Operation Manager',
};

const FINANCE_USER = {
  _id: 'u-fin',
  permissions: ['po.view', 'po.approve.finance'],
  role: { _id: 'role-fin', name: 'Finance' },
  roleName: 'Finance',
};

const VIEW_ALL_USER = {
  _id: 'u-view',
  permissions: ['view.all'],
  role: { _id: 'role-auditor', name: 'Auditor' },
  roleName: 'Auditor',
};

const PROCUREMENT = {
  _id: 'u-proc',
  permissions: ['pr.create', 'pr.edit', 'po.create', 'po.edit'],
  role: { _id: 'role-proc', name: 'Procurement' },
  roleName: 'Procurement',
};

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

const PO_STEPS = [
  {
    stepOrder: 1,
    stepName: 'PM Approval',
    requiredPermission: 'po.approve.pm',
    isActive: true,
    approverRole: { _id: 'role-pm', name: 'Project Manager' },
  },
  {
    stepOrder: 2,
    stepName: 'OM Approval',
    requiredPermission: 'po.approve.om',
    isActive: true,
    approverRole: { _id: 'role-om', name: 'Operation Manager' },
  },
  {
    stepOrder: 3,
    stepName: 'Finance Approval',
    requiredPermission: 'po.approve.finance',
    isActive: true,
    approverRole: { _id: 'role-fin', name: 'Finance' },
  },
];

function poAtStep(stepOrder) {
  const statusByStep = {
    1: PO_STATUS.PENDING_PM,
    2: PO_STATUS.PENDING_OM,
    3: PO_STATUS.PENDING_FINANCE,
  };
  return { id: 'po1', status: statusByStep[stepOrder], currentApprovalStep: stepOrder };
}

describe('authorization audit — exact-step approval', () => {
  it('Warehouse can approve only pr.approve.whs step', () => {
    const pr = { id: 'pr1', status: 'Pending Warehouse Approval', currentApprovalStep: 1 };
    expect(
      canUserApproveDocument({
        documentType: 'PR',
        document: pr,
        user: WHS_USER,
        approvalSteps: PR_STEPS,
        logDiagnostics: false,
      }),
    ).toBe(true);
  });

  it('Warehouse cannot approve PO PM step', () => {
    expect(
      canUserApproveDocument({
        documentType: 'PO',
        document: poAtStep(1),
        user: WHS_USER,
        approvalSteps: PO_STEPS,
        logDiagnostics: false,
      }),
    ).toBe(false);
  });

  it('Warehouse cannot approve PO OM or Finance steps', () => {
    for (const step of [2, 3]) {
      expect(
        canUserApproveDocument({
          documentType: 'PO',
          document: poAtStep(step),
          user: WHS_USER,
          approvalSteps: PO_STEPS,
          logDiagnostics: false,
        }),
      ).toBe(false);
    }
  });

  it('PM cannot approve OM step; OM cannot approve Finance; Finance cannot approve PM', () => {
    expect(
      canUserApproveDocument({
        documentType: 'PO',
        document: poAtStep(2),
        user: PM_USER,
        approvalSteps: PO_STEPS,
        logDiagnostics: false,
      }),
    ).toBe(false);
    expect(
      canUserApproveDocument({
        documentType: 'PO',
        document: poAtStep(3),
        user: OM_USER,
        approvalSteps: PO_STEPS,
        logDiagnostics: false,
      }),
    ).toBe(false);
    expect(
      canUserApproveDocument({
        documentType: 'PO',
        document: poAtStep(1),
        user: FINANCE_USER,
        approvalSteps: PO_STEPS,
        logDiagnostics: false,
      }),
    ).toBe(false);
  });

  it('PM approves PM step; OM approves OM step; Finance approves Finance step', () => {
    expect(
      canUserApproveDocument({
        documentType: 'PO',
        document: poAtStep(1),
        user: PM_USER,
        approvalSteps: PO_STEPS,
        logDiagnostics: false,
      }),
    ).toBe(true);
    expect(
      canUserApproveDocument({
        documentType: 'PO',
        document: poAtStep(2),
        user: OM_USER,
        approvalSteps: PO_STEPS,
        logDiagnostics: false,
      }),
    ).toBe(true);
    expect(
      canUserApproveDocument({
        documentType: 'PO',
        document: poAtStep(3),
        user: FINANCE_USER,
        approvalSteps: PO_STEPS,
        logDiagnostics: false,
      }),
    ).toBe(true);
  });

  it('view.all does not approve any workflow step', () => {
    expect(
      canUserApproveDocument({
        documentType: 'PO',
        document: poAtStep(1),
        user: VIEW_ALL_USER,
        approvalSteps: PO_STEPS,
        logDiagnostics: false,
      }),
    ).toBe(false);
    expect(
      buildDocumentApprovalAccess({
        documentType: 'PO',
        document: poAtStep(1),
        user: VIEW_ALL_USER,
        approvalSteps: PO_STEPS,
      }).canApproveCurrentStep,
    ).toBe(false);
  });

  it('future-step permission does not allow early approval', () => {
    expect(
      canUserApproveDocument({
        documentType: 'PO',
        document: poAtStep(1),
        user: FINANCE_USER,
        approvalSteps: PO_STEPS,
        logDiagnostics: false,
      }),
    ).toBe(false);
  });
});

describe('authorization audit — editing and read-only', () => {
  it('Warehouse cannot edit PR or PO', () => {
    expect(canEditPurchaseRequest(WHS_USER, { status: 'Rejected' })).toBe(false);
    expect(canEditPurchaseOrder(WHS_USER, { status: PO_STATUS.REJECTED }, [])).toBe(false);
  });

  it('view.all and admin.settings do not grant edit', () => {
    const admin = { permissions: ['admin.settings', 'view.all'] };
    expect(canEditPurchaseRequest(admin, { status: 'Rejected' })).toBe(false);
    expect(canEditPurchaseOrder(admin, { status: PO_STATUS.REJECTED }, [])).toBe(false);
  });

  it('Procurement with pr.edit/po.edit can edit rejected documents', () => {
    expect(canEditPurchaseRequest(PROCUREMENT, { status: 'Rejected' })).toBe(true);
    expect(canEditPurchaseOrder(PROCUREMENT, { status: PO_STATUS.REJECTED }, [])).toBe(true);
  });

  it('SAP-created documents cannot be edited', () => {
    expect(
      canEditPurchaseRequest(PROCUREMENT, { status: 'Rejected', sapPRDocEntry: 100 }),
    ).toBe(false);
    expect(
      canEditPurchaseOrder(PROCUREMENT, { status: PO_STATUS.REJECTED, sapPODocEntry: 200 }, []),
    ).toBe(false);
  });

  it('view.all is read-only — no PO create or SAP retry', () => {
    expect(userHasGlobalReadAccess(VIEW_ALL_USER)).toBe(true);
    expect(canCreatePoFromPr(VIEW_ALL_USER)).toBe(false);
    expect(canRetrySapPurchaseRequest(VIEW_ALL_USER)).toBe(false);
  });

  it('view.all cannot edit APRI quantities', () => {
    expect(
      userCanEditApriQuantities(VIEW_ALL_USER, {
        status: 'Warehouse Rejected',
        createdBy: 'other-user',
      }),
    ).toBe(false);
  });
});

describe('authorization audit — navigation and settings', () => {
  it('Warehouse does not see System Logs', () => {
    const settings = getVisibleSettingsNav(WHS_USER.permissions);
    expect(settings.some((item) => item.href === '/settings/system-logs')).toBe(false);
  });

  it('admin.system_logs (or legacy admin.settings) required for System Logs page', () => {
    expect(canAccessSettingsPath(['admin.system_logs'], '/settings/system-logs')).toBe(true);
    expect(canAccessSettingsPath(['admin.settings'], '/settings/system-logs')).toBe(true);
    expect(canAccessSettingsPath(WHS_USER.permissions, '/settings/system-logs')).toBe(false);
    expect(canAccessSettingsPath(['view.all'], '/settings/system-logs')).toBe(false);
  });
});
