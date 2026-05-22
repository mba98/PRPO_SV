import { describe, expect, it } from 'vitest';
import { buildDocumentWorkflow } from '@/lib/workflowSteps';

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
