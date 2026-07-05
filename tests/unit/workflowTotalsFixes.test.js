import { describe, expect, it } from 'vitest';
import {
  buildApprovalWorkflowSteps,
  buildDocumentWorkflow,
  buildReturnedToProcurementStep,
  buildSapWorkflowStep,
  loadApriWorkflow,
} from '@/lib/workflowSteps.js';
import { PO_STATUS } from '@/lib/poStatus.js';
import { APRI_STATUS } from '@/lib/apriStatus.js';
import { parseNumberAllowZero } from '@/lib/numberParsing.js';
import { recalcPoLineTotal, sumPoLineTotals } from '@/lib/poFormUtils.js';
import {
  sumPrDocumentTotal,
  sumPoDocumentTotal,
  sumApriDocumentTotal,
  sumLineQuantities,
} from '@/lib/documentTotals.js';
import { sanitizeApriFinancialFields } from '@/lib/apriFinancialAccess.js';

const PR_STEPS = [
  { stepOrder: 1, stepName: 'Warehouse Approval', requiredPermission: 'pr.approve.whs' },
  { stepOrder: 2, stepName: 'Project Manager Approval', requiredPermission: 'pr.approve.pm' },
];

const PO_STEPS = [
  { stepOrder: 1, stepName: 'Project Manager Approval', requiredPermission: 'po.approve.pm' },
  { stepOrder: 2, stepName: 'Finance Approval', requiredPermission: 'po.approve.finance' },
];

const APRI_STEPS = [
  { stepOrder: 1, stepName: 'Warehouse Approval', requiredPermission: 'pr.approve.whs' },
];

describe('workflow stepper fixes', () => {
  it('marks PR Warehouse completed after approval and SAP created has no pending WHS', () => {
    const approved = buildApprovalWorkflowSteps(
      PR_STEPS,
      { status: 'Pending Project Manager Approval', currentApprovalStep: 2 },
      'PR',
      { permissions: [] },
    );
    expect(approved[0].state).toBe('completed');

    const inSap = buildDocumentWorkflow(
      PR_STEPS,
      { status: 'Created in SAP', currentApprovalStep: 2, sapPRDocEntry: 42 },
      'PR',
      { permissions: [] },
    );
    expect(inSap[0].state).toBe('completed');
    expect(inSap[1].state).toBe('completed');
    expect(inSap[2].state).toBe('sap_created');
    expect(inSap.filter((s) => s.state === 'current')).toHaveLength(0);
  });

  it('marks all PO approval steps completed when SAP PO is created', () => {
    const workflow = buildDocumentWorkflow(
      PO_STEPS,
      {
        status: PO_STATUS.CREATED_IN_SAP,
        currentApprovalStep: 2,
        sapPODocEntry: 100,
      },
      'PO',
      { permissions: [] },
      { includeCreated: true },
    );
    const approvals = workflow.filter((s) => s.kind === 'approval');
    expect(approvals.every((s) => s.state === 'completed')).toBe(true);
    expect(workflow.find((s) => s.kind === 'sap')?.state).toBe('sap_created');
  });

  it('marks APRI WHS completed after warehouse approval and after SAP creation', async () => {
    const approved = buildApprovalWorkflowSteps(
      APRI_STEPS,
      { status: APRI_STATUS.WAREHOUSE_APPROVED, currentApprovalStep: 0 },
      'APRI',
      { permissions: [] },
    );
    expect(approved[0].state).toBe('completed');

    const workflow = await loadApriWorkflow(
      {
        status: APRI_STATUS.CREATED_IN_SAP,
        currentApprovalStep: 0,
        sapAPDocEntry: 200,
      },
      { permissions: [] },
      APRI_STEPS,
    );
    const warehouse = workflow.find((s) => s.stepName === 'Warehouse Approval');
    const sap = workflow.find((s) => s.kind === 'sap');
    const returned = workflow.find((s) => s.kind === 'procurement');
    expect(warehouse.state).toBe('completed');
    expect(returned.state).toBe('completed');
    expect(sap.state).toBe('sap_created');
    expect(workflow.filter((s) => s.state === 'current')).toHaveLength(0);
  });

  it('does not mark SAP created for rejected APRI', () => {
    const sap = buildSapWorkflowStep(
      { status: APRI_STATUS.WAREHOUSE_REJECTED, currentApprovalStep: 0 },
      3,
      'APRI',
    );
    expect(sap.state).toBe('pending');
  });

  it('only one step is current during in-progress PO approval', () => {
    const workflow = buildDocumentWorkflow(
      PO_STEPS,
      { status: PO_STATUS.PENDING_FINANCE, currentApprovalStep: 2 },
      'PO',
      { permissions: [] },
      { includeCreated: true },
    );
    const currentSteps = workflow.filter((s) => s.state === 'current');
    expect(currentSteps).toHaveLength(1);
    expect(currentSteps[0].stepName).toBe('Finance Approval');
  });
});

describe('unit price zero handling', () => {
  it('parseNumberAllowZero preserves zero', () => {
    expect(parseNumberAllowZero(0)).toBe(0);
    expect(parseNumberAllowZero('0')).toBe(0);
    expect(parseNumberAllowZero('')).toBe(0);
    expect(parseNumberAllowZero('', 5)).toBe(5);
    expect(parseNumberAllowZero(null, 3)).toBe(3);
  });

  it('PO line total is zero when unit price is zero', () => {
    expect(recalcPoLineTotal({ quantity: 2, unitPrice: 0 })).toBe(0);
    expect(sumPoLineTotals([{ quantity: 2, unitPrice: 0 }])).toBe(0);
  });

  it('PR document total includes zero-priced lines', () => {
    expect(
      sumPrDocumentTotal([
        { quantity: 2, estimatedUnitPrice: 0 },
        { quantity: 1, estimatedUnitPrice: 10 },
      ]),
    ).toBe(10);
  });
});

describe('document totals', () => {
  it('computes PO and APRI document totals server-side', () => {
    expect(sumPoDocumentTotal([{ quantity: 3, unitPrice: 5 }])).toBe(15);
    expect(sumApriDocumentTotal([{ quantity: 2, unitPrice: 0 }])).toBe(0);
    expect(sumLineQuantities([{ quantity: 2 }, { quantity: 1.5 }])).toBe(3.5);
  });

  it('APRI warehouse sanitize omits documentTotal but keeps totalQuantity', () => {
    const sanitized = sanitizeApriFinancialFields(
      {
        id: '1',
        portalAPNumber: 'AP-1',
        lines: [{ quantity: 2, unitPrice: 100, lineTotal: 200 }],
        documentTotal: 200,
        totalQuantity: 2,
      },
      false,
    );
    expect(sanitized.documentTotal).toBeUndefined();
    expect(sanitized.totalQuantity).toBe(2);
    expect(sanitized.lines[0].unitPrice).toBeUndefined();
  });
});
