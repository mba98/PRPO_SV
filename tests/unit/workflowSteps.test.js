import { describe, expect, it } from 'vitest';
import {
  buildDocumentWorkflow,
  canApproveCurrentWorkflowStep,
  buildApriWorkflow,
} from '@/lib/workflowSteps';

const STEPS = [
  { stepOrder: 1, stepName: 'Warehouse Approval', requiredPermission: 'pr.approve.whs' },
  { stepOrder: 2, stepName: 'Project Manager Approval', requiredPermission: 'pr.approve.pm' },
];

describe('workflowSteps', () => {
  it('marks PM step current after WHS approval', () => {
    const doc = {
      status: 'Pending Project Manager Approval',
      currentApprovalStep: 2,
    };
    const pmUser = { permissions: [], role: { permissions: ['pr.approve.pm'] } };
    const workflow = buildDocumentWorkflow(STEPS, doc, 'PR', pmUser);
    expect(workflow).toHaveLength(3);
    expect(workflow[0].state).toBe('completed');
    expect(workflow[1].state).toBe('current');
    expect(workflow[1].canApprove).toBe(true);
    expect(workflow[2].stepName).toBe('SAP Created');
    expect(workflow[2].state).toBe('pending');
  });

  it('includes dynamic SAP step states', () => {
    const doc = { status: 'Failed to Create in SAP', currentApprovalStep: 2, sapPRDocEntry: null };
    const workflow = buildDocumentWorkflow(STEPS, doc, 'PR', { permissions: ['view.all'] });
    expect(workflow[2].state).toBe('sap_failed');
  });
});

const PO_STEPS = [
  { stepOrder: 1, stepName: 'Project Manager Approval', requiredPermission: 'po.approve.pm' },
  { stepOrder: 2, stepName: 'Finance Approval', requiredPermission: 'po.approve.finance' },
];

describe('PO approval step permissions', () => {
  it('PM user cannot approve when PO is on Finance step', () => {
    const doc = {
      status: 'Pending Finance Approval',
      currentApprovalStep: 2,
    };
    const pmUser = { permissions: [], role: { permissions: ['po.approve.pm'] } };
    const workflow = buildDocumentWorkflow(PO_STEPS, doc, 'PO', pmUser, {
      includeCreated: true,
    });
    const financeStep = workflow.find((s) => s.stepName === 'Finance Approval');
    expect(financeStep.state).toBe('current');
    expect(financeStep.canApprove).toBe(false);
    expect(canApproveCurrentWorkflowStep(workflow)).toBe(false);
  });

  it('Finance user can approve when PO is on Finance step', () => {
    const doc = {
      status: 'Pending Finance Approval',
      currentApprovalStep: 2,
    };
    const financeUser = { permissions: [], role: { permissions: ['po.approve.finance'] } };
    const workflow = buildDocumentWorkflow(PO_STEPS, doc, 'PO', financeUser, {
      includeCreated: true,
    });
    expect(canApproveCurrentWorkflowStep(workflow)).toBe(true);
  });
});

describe('APRI workflow', () => {
  it('builds Created and SAP APRI steps', () => {
    const workflow = buildApriWorkflow({
      status: 'Ready for AP Reserve Invoice',
      sapAPDocEntry: null,
    });
    expect(workflow).toHaveLength(2);
    expect(workflow[0].kind).toBe('created');
    expect(workflow[0].state).toBe('current');
    expect(workflow[1].kind).toBe('sap');
    expect(workflow[1].state).toBe('pending');
  });

  it('marks SAP step created when sapAPDocEntry exists', () => {
    const workflow = buildApriWorkflow({
      status: 'Created in SAP',
      sapAPDocEntry: 100,
    });
    expect(workflow[1].state).toBe('sap_created');
  });
});
