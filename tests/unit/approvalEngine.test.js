import { describe, expect, it } from 'vitest';
import {
  getCurrentStep,
  getInitialSubmitState,
  getStateAfterApproval,
  pendingStatusForStep,
  userCanApproveStep,
} from '@/lib/approvalEngine';
import { PO_STATUS } from '@/lib/poStatus';

const STEPS = [
  { stepOrder: 1, stepName: 'Warehouse Approval', requiredPermission: 'pr.approve.whs' },
  { stepOrder: 2, stepName: 'Project Manager Approval', requiredPermission: 'pr.approve.pm' },
];

describe('approvalEngine', () => {
  it('maps steps to pending statuses from matrix permissions', () => {
    expect(pendingStatusForStep(STEPS[0])).toBe('Pending Warehouse Approval');
    expect(pendingStatusForStep(STEPS[1])).toBe('Pending Project Manager Approval');
  });

  it('initial submit targets first step', () => {
    const state = getInitialSubmitState(STEPS);
    expect(state.currentApprovalStep).toBe(1);
    expect(state.status).toBe('Pending Warehouse Approval');
  });

  it('advances to next step or final approved', () => {
    const mid = getStateAfterApproval(STEPS, 1);
    expect(mid.isFinal).toBe(false);
    expect(mid.status).toBe('Pending Project Manager Approval');

    const fin = getStateAfterApproval(STEPS, 2);
    expect(fin.isFinal).toBe(true);
    expect(fin.status).toBe('Approved');
  });

  it('checks approver permission for step', () => {
    const whsUser = { permissions: ['pr.approve.whs'] };
    const pmUser = { permissions: ['pr.approve.pm'] };
    expect(userCanApproveStep(whsUser, STEPS[0])).toBe(true);
    expect(userCanApproveStep(whsUser, STEPS[1])).toBe(false);
    expect(userCanApproveStep(pmUser, STEPS[1])).toBe(true);
    expect(userCanApproveStep({ permissions: ['view.all'] }, STEPS[0])).toBe(false);
  });

  it('uses role permissions when user.permissions is empty', () => {
    const pmUser = { permissions: [], role: { permissions: ['pr.approve.pm'] } };
    expect(userCanApproveStep(pmUser, STEPS[1])).toBe(true);
    expect(userCanApproveStep(pmUser, STEPS[0])).toBe(false);
  });

  it('resolves current step by order', () => {
    expect(getCurrentStep(STEPS, 2)?.stepName).toBe('Project Manager Approval');
    expect(getCurrentStep(STEPS, 0)).toBeNull();
  });

  it('supports PO document type statuses with operation manager step', () => {
    const poSteps = [
      { stepOrder: 1, requiredPermission: 'po.approve.pm' },
      { stepOrder: 2, requiredPermission: 'po.approve.om' },
      { stepOrder: 3, requiredPermission: 'po.approve.finance' },
    ];
    expect(getInitialSubmitState(poSteps, 'PO').status).toBe(PO_STATUS.PENDING_PM);
    expect(getStateAfterApproval(poSteps, 1, 'PO').status).toBe(PO_STATUS.PENDING_OM);
    expect(getStateAfterApproval(poSteps, 2, 'PO').status).toBe(PO_STATUS.PENDING_FINANCE);
    expect(getStateAfterApproval(poSteps, 3, 'PO').isFinal).toBe(true);
  });

  it('supports APRI warehouse approval status', () => {
    const apriSteps = [{ stepOrder: 1, requiredPermission: 'pr.approve.whs' }];
    expect(getInitialSubmitState(apriSteps, 'APRI').status).toBe('pending_warehouse');
    const fin = getStateAfterApproval(apriSteps, 1, 'APRI');
    expect(fin.isFinal).toBe(true);
    expect(fin.status).toBe('warehouse_approved');
    expect(fin.currentApprovalStep).toBe(0);
  });
});
