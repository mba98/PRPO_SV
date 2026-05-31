import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getDictionary } from '@/lib/i18n';
import { buildDocumentWorkflow } from '@/lib/workflowSteps';

const PR_STEPS = [
  { stepOrder: 1, stepName: 'Warehouse Approval', requiredPermission: 'pr.approve.whs' },
  { stepOrder: 2, stepName: 'Project Manager Approval', requiredPermission: 'pr.approve.pm' },
];

describe('WorkflowStepper UI', () => {
  const stepper = fs.readFileSync(
    path.resolve(process.cwd(), 'components/workflow/WorkflowStepper.jsx'),
    'utf8',
  );
  const css = fs.readFileSync(path.resolve(process.cwd(), 'app/globals.css'), 'utf8');
  const prDetail = fs.readFileSync(
    path.resolve(process.cwd(), 'components/purchase-requests/PrDetailView.jsx'),
    'utf8',
  );
  const poDetail = fs.readFileSync(
    path.resolve(process.cwd(), 'components/purchase-orders/PoDetailView.jsx'),
    'utf8',
  );

  it('renders themed connector and primary CSS variables', () => {
    expect(stepper).toContain('workflow-connector-line--active');
    expect(stepper).toContain('var(--primary)');
    expect(stepper).toContain('WorkflowConnector');
    expect(css).toContain('.workflow-stepper');
    expect(css).toContain('var(--primary)');
  });

  it('uses Framer Motion with reduced motion guard', () => {
    expect(stepper).toContain('useReducedMotion');
    expect(stepper).toContain('useMotionSafe');
    expect(stepper).toContain('useI18n');
  });

  it('supports RTL list direction', () => {
    expect(stepper).toContain('workflow-stepper-list--rtl');
    expect(stepper).toContain('isRtl');
    expect(stepper).toContain('rotate-180');
  });

  it('has vertical mobile and horizontal desktop layout', () => {
    expect(stepper).toContain('md:hidden');
    expect(stepper).toContain('md:flex');
    expect(stepper).toContain('flex-col');
    expect(css).toContain('md:flex-row');
    expect(css).toContain('workflow-stepper-list');
  });

  it('Arabic and English workflow labels exist', () => {
    expect(getDictionary('en').workflow.current).toBe('Current');
    expect(getDictionary('ar').workflow.current).toBe('الحالية');
    expect(getDictionary('en').workflow.warehouseApproval).toBe('Warehouse Approval');
    expect(getDictionary('ar').workflow.warehouseApproval).toBe('موافقة المخزن');
    expect(getDictionary('en').workflow.sapPoCreated).toBe('SAP PO Created');
    expect(getDictionary('ar').workflow.sapPoCreated).toBe('تم إنشاء PO في SAP');
  });

  it('PR and PO detail pages use WorkflowStepper with documentType', () => {
    expect(prDetail).toContain('<WorkflowStepper');
    expect(prDetail).toContain('documentType="PR"');
    expect(poDetail).toContain('<WorkflowStepper');
    expect(poDetail).toContain('documentType="PO"');
  });
});

describe('WorkflowStepper step states from workflow builder', () => {
  it('marks current step for PR workflow', () => {
    const doc = {
      status: 'Pending Project Manager Approval',
      currentApprovalStep: 2,
    };
    const workflow = buildDocumentWorkflow(PR_STEPS, doc, 'PR', {
      permissions: [],
      role: { permissions: ['pr.approve.pm'] },
    });
    const current = workflow.find((s) => s.state === 'current');
    expect(current?.stepName).toMatch(/Project Manager/i);
    expect(workflow[0].state).toBe('completed');
  });

  it('marks completed steps before current', () => {
    const doc = {
      status: 'Pending Project Manager Approval',
      currentApprovalStep: 2,
    };
    const workflow = buildDocumentWorkflow(PR_STEPS, doc, 'PR', { permissions: ['view.all'] });
    expect(workflow.filter((s) => s.state === 'completed').length).toBeGreaterThanOrEqual(1);
  });
});
