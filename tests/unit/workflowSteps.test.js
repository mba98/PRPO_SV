import { describe, expect, it } from 'vitest';
import {
  buildDocumentWorkflow,
  buildReturnedToProcurementStep,
  canApproveCurrentWorkflowStep,
  loadApriWorkflow,
} from '@/lib/workflowSteps';
import { PO_STATUS } from '@/lib/poStatus';
import { APRI_STATUS } from '@/lib/apriStatus';

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
  { stepOrder: 2, stepName: 'Operation Manager Approval', requiredPermission: 'po.approve.om' },
  { stepOrder: 3, stepName: 'Finance Approval', requiredPermission: 'po.approve.finance' },
];

describe('PO approval step permissions', () => {
  it('PM user cannot approve when PO is on Finance step', () => {
    const doc = {
      status: PO_STATUS.PENDING_FINANCE,
      currentApprovalStep: 3,
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
      status: PO_STATUS.PENDING_FINANCE,
      currentApprovalStep: 3,
    };
    const financeUser = { permissions: [], role: { permissions: ['po.approve.finance'] } };
    const workflow = buildDocumentWorkflow(PO_STEPS, doc, 'PO', financeUser, {
      includeCreated: true,
    });
    expect(canApproveCurrentWorkflowStep(workflow)).toBe(true);
  });
});

const APRI_STEPS = [
  { stepOrder: 1, stepName: 'Warehouse Approval', requiredPermission: 'pr.approve.whs' },
];

describe('APRI workflow', () => {
  it('builds Created, warehouse approval, and SAP APRI steps', () => {
    const doc = {
      status: 'Pending Warehouse Approval',
      currentApprovalStep: 1,
      sapAPDocEntry: null,
    };
    const whsUser = { permissions: [], role: { permissions: ['pr.approve.whs'] } };
    const workflow = buildDocumentWorkflow(APRI_STEPS, doc, 'APRI', whsUser, {
      includeCreated: true,
    });
    expect(workflow[0].kind).toBe('created');
    expect(workflow[1].state).toBe('current');
    expect(workflow[1].canApprove).toBe(true);
    expect(workflow[workflow.length - 1].kind).toBe('sap');
    expect(workflow[workflow.length - 1].state).toBe('pending');
  });

  it('marks SAP step created when sapAPDocEntry exists', () => {
    const doc = {
      status: 'Created in SAP',
      currentApprovalStep: 1,
      sapAPDocEntry: 100,
    };
    const workflow = buildDocumentWorkflow(APRI_STEPS, doc, 'APRI', { permissions: ['view.all'] }, {
      includeCreated: true,
    });
    const sapStep = workflow.find((s) => s.kind === 'sap');
    expect(sapStep.state).toBe('sap_created');
  });

  it('shows returned to procurement current and SAP pending for warehouse rejected APRI', async () => {
    const doc = {
      status: APRI_STATUS.WAREHOUSE_REJECTED,
      currentApprovalStep: 0,
      sapAPDocEntry: null,
    };
    const workflow = await loadApriWorkflow(doc, { permissions: [] }, APRI_STEPS);
    const warehouse = workflow.find((s) => s.stepName === 'Warehouse Approval');
    const returned = workflow.find((s) => s.kind === 'procurement');
    const sap = workflow.find((s) => s.kind === 'sap');
    expect(warehouse.state).toBe('rejected');
    expect(returned.state).toBe('current');
    expect(sap.state).toBe('pending');
  });

  it('buildReturnedToProcurementStep is completed after SAP creation starts', () => {
    const step = buildReturnedToProcurementStep(
      { status: APRI_STATUS.CREATING_IN_SAP },
      2,
    );
    expect(step.state).toBe('completed');
  });
});
