import { describe, expect, it } from 'vitest';
import {
  getInitialSubmitState,
  getStateAfterApproval,
  pendingStatusForStep,
  userCanApproveStep,
} from '@/lib/approvalEngine';

const PO_STEPS = [
  { stepOrder: 1, stepName: 'Project Manager Approval', requiredPermission: 'po.approve.pm' },
  { stepOrder: 2, stepName: 'Finance Approval', requiredPermission: 'po.approve.finance' },
];

describe('PO approval flow', () => {
  it('starts at Pending Project Manager Approval', () => {
    const state = getInitialSubmitState(PO_STEPS, 'PO');
    expect(state.status).toBe('Pending Project Manager Approval');
    expect(state.currentApprovalStep).toBe(1);
  });

  it('advances to finance then approved', () => {
    const mid = getStateAfterApproval(PO_STEPS, 1, 'PO');
    expect(mid.status).toBe('Pending Finance Approval');
    expect(mid.isFinal).toBe(false);

    const fin = getStateAfterApproval(PO_STEPS, 2, 'PO');
    expect(fin.status).toBe('Approved');
    expect(fin.isFinal).toBe(true);
  });

  it('enforces approver permissions', () => {
    expect(userCanApproveStep({ permissions: ['po.approve.pm'] }, PO_STEPS[0])).toBe(true);
    expect(userCanApproveStep({ permissions: ['po.approve.pm'] }, PO_STEPS[1])).toBe(false);
    expect(userCanApproveStep({ permissions: ['po.approve.finance'] }, PO_STEPS[1])).toBe(true);
  });

  it('maps step permissions to PO statuses', () => {
    expect(pendingStatusForStep(PO_STEPS[0], 'PO')).toBe('Pending Project Manager Approval');
    expect(pendingStatusForStep(PO_STEPS[1], 'PO')).toBe('Pending Finance Approval');
  });
});
