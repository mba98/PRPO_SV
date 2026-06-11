import { describe, expect, it } from 'vitest';
import {
  PO_STATUS,
  normalizePoStatus,
  pendingPoStatusForStep,
  poStatusLabel,
  poStatusVariants,
  poStatusesEqual,
} from '@/lib/poStatus';
import {
  getInitialSubmitState,
  getStateAfterApproval,
  pendingStatusForStep,
} from '@/lib/approvalEngine';

const PO_STEPS = [
  { stepOrder: 1, stepName: 'Project Manager', requiredPermission: 'po.approve.pm' },
  { stepOrder: 2, stepName: 'Operation Manager', requiredPermission: 'po.approve.om' },
  { stepOrder: 3, stepName: 'Finance', requiredPermission: 'po.approve.finance' },
];

describe('poStatus', () => {
  it('normalizes legacy display strings to stable keys', () => {
    expect(normalizePoStatus('Pending Project Manager')).toBe(PO_STATUS.PENDING_PM);
    expect(normalizePoStatus('Pending Project Manager Approval')).toBe(PO_STATUS.PENDING_PM);
    expect(normalizePoStatus('Failed to Create in SAP')).toBe(PO_STATUS.FAILED_SAP);
    expect(normalizePoStatus('pending_pm')).toBe(PO_STATUS.PENDING_PM);
  });

  it('maps stable keys to display labels', () => {
    expect(poStatusLabel(PO_STATUS.PENDING_PM)).toBe('Pending Project Manager');
    expect(poStatusLabel('Pending Operation Manager Approval')).toBe('Pending Operation Manager');
  });

  it('treats legacy and stable values as equal', () => {
    expect(poStatusesEqual('Pending Project Manager', PO_STATUS.PENDING_PM)).toBe(true);
    expect(poStatusesEqual('Created in SAP', PO_STATUS.CREATED_IN_SAP)).toBe(true);
  });

  it('includes legacy variants for Mongo queries', () => {
    const variants = poStatusVariants(PO_STATUS.PENDING_PM);
    expect(variants).toContain(PO_STATUS.PENDING_PM);
    expect(variants).toContain('Pending Project Manager');
    expect(variants).toContain('Pending Project Manager Approval');
  });

  it('resolves pending status from matrix step name without Approval suffix', () => {
    expect(pendingPoStatusForStep(PO_STEPS[0])).toBe(PO_STATUS.PENDING_PM);
    expect(pendingPoStatusForStep(PO_STEPS[1])).toBe(PO_STATUS.PENDING_OM);
    expect(pendingPoStatusForStep(PO_STEPS[2])).toBe(PO_STATUS.PENDING_FINANCE);
  });

  it('ignores generic pendingStatus labels when permission maps to stable key', () => {
    expect(
      pendingPoStatusForStep({
        stepName: 'Finance Approval',
        requiredPermission: 'po.approve.finance',
        pendingStatus: 'Pending approval',
      }),
    ).toBe(PO_STATUS.PENDING_FINANCE);
  });

  it('advances OM approval to pending_finance even with bad matrix pendingStatus', () => {
    const steps = [
      { stepOrder: 1, requiredPermission: 'po.approve.pm', stepName: 'PM' },
      {
        stepOrder: 2,
        requiredPermission: 'po.approve.om',
        stepName: 'Operation Manager',
        pendingStatus: 'Pending approval',
      },
      {
        stepOrder: 3,
        requiredPermission: 'po.approve.finance',
        stepName: 'Finance',
        pendingStatus: 'Pending approval',
      },
    ];
    expect(getStateAfterApproval(steps, 2, 'PO')).toMatchObject({
      status: PO_STATUS.PENDING_FINANCE,
      currentApprovalStep: 3,
      isFinal: false,
    });
  });
});

describe('PO approval flow with stable status keys', () => {
  it('creates PO at pending_pm', () => {
    const state = getInitialSubmitState(PO_STEPS, 'PO');
    expect(state.status).toBe(PO_STATUS.PENDING_PM);
    expect(state.currentApprovalStep).toBe(1);
  });

  it('advances PM → OM → Finance → approved', () => {
    expect(getStateAfterApproval(PO_STEPS, 1, 'PO').status).toBe(PO_STATUS.PENDING_OM);
    expect(getStateAfterApproval(PO_STEPS, 2, 'PO').status).toBe(PO_STATUS.PENDING_FINANCE);
    expect(getStateAfterApproval(PO_STEPS, 3, 'PO')).toMatchObject({
      status: PO_STATUS.APPROVED,
      isFinal: true,
    });
  });

  it('maps step permissions through approvalEngine', () => {
    expect(pendingStatusForStep(PO_STEPS[0], 'PO')).toBe(PO_STATUS.PENDING_PM);
    expect(pendingStatusForStep(PO_STEPS[1], 'PO')).toBe(PO_STATUS.PENDING_OM);
    expect(pendingStatusForStep(PO_STEPS[2], 'PO')).toBe(PO_STATUS.PENDING_FINANCE);
  });
});
