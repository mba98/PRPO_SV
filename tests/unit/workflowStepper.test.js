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
  const apriDetail = fs.readFileSync(
    path.resolve(process.cwd(), 'components/ap-reserve-invoices/ApriDetailView.jsx'),
    'utf8',
  );

  it('renders themed connector and primary CSS variables', () => {
    expect(stepper).toContain('workflow-connector-line--active');
    expect(stepper).toContain('var(--primary)');
    expect(stepper).toContain('WorkflowConnector');
    expect(css).toContain('.workflow-stepper');
    expect(css).toContain('var(--primary)');
  });

  it('active connector lines use one-time fill animation with reduced-motion fallback', () => {
    expect(css).toContain('@keyframes workflowConnectorFill');
    expect(css).toContain('workflowConnectorFill 0.45s');
    expect(css).toContain("[dir='ltr'] .workflow-connector-line--active");
    expect(css).toContain('transform-origin: left center');
    expect(css).toContain("[dir='rtl'] .workflow-connector-line--active");
    expect(css).toContain('transform-origin: right center');
    expect(css).toContain('prefers-reduced-motion: reduce');
    expect(css).toContain('@keyframes workflowConnectorFillVertical');
  });

  it('uses Framer Motion with reduced motion guard', () => {
    expect(stepper).toContain('useReducedMotion');
    expect(stepper).toContain('useMotionSafe');
    expect(stepper).toContain('useI18n');
  });

  it('English LTR keeps logical step order with dir=ltr on desktop row', () => {
    expect(stepper).toContain('const flowDir = isRtl ? \'rtl\' : \'ltr\'');
    expect(stepper).toContain('computedSteps.map');
    expect(stepper).not.toContain('[...computedSteps].reverse()');
    expect(stepper).toContain('warehouseApproval');
    expect(stepper).toContain('projectManagerApproval');
    expect(stepper).toContain('sapCreated');
  });

  it('Arabic RTL uses dir=rtl so first logical step renders on the right', () => {
    expect(stepper).toContain('const computedSteps = steps.map');
    expect(stepper).toContain('dir={flowDir}');
    expect(stepper).not.toContain('dir="ltr"');
    expect(stepper).not.toContain('workflow-stepper-list--rtl');
    expect(css).not.toContain('flex-row-reverse');
    expect(css).toContain("[dir='rtl'] .workflow-connector-line--active");
  });

  it('uses ArrowLeft for RTL and ArrowRight for LTR connectors', () => {
    expect(stepper).toContain('ArrowLeftIcon');
    expect(stepper).toContain('ArrowRightIcon');
    expect(stepper).toContain('isRtl ? <ArrowLeftIcon /> : <ArrowRightIcon />');
    expect(stepper).toContain('x: isRtl ? [0, -4, 0] : [0, 4, 0]');
    expect(stepper).not.toContain('rotate-180');
  });

  it('uses text-start and avoids hardcoded left-only layout classes', () => {
    expect(stepper).toContain('text-start');
    expect(stepper).not.toMatch(/text-left/);
    expect(stepper).not.toContain('workflow-stepper-list--rtl');
  });

  it('connector active state uses the preceding logical step in flow order', () => {
    expect(stepper).toContain('connectorActive(computedSteps[visualIndex].state)');
  });

  it('has vertical mobile and horizontal desktop layout', () => {
    expect(stepper).toContain('workflow-stepper-mobile');
    expect(stepper).toContain('workflow-stepper-row');
    expect(stepper).toContain('md:hidden');
    expect(stepper).toContain('hidden md:flex');
    expect(css).toContain('min-w-[9.5rem]');
  });

  it('Arabic and English workflow labels exist', () => {
    expect(getDictionary('en').workflow.current).toBe('Current');
    expect(getDictionary('ar').workflow.current).toBe('الحالية');
    expect(getDictionary('en').workflow.completed).toBe('Completed');
    expect(getDictionary('ar').workflow.completed).toBe('مكتملة');
    expect(getDictionary('en').workflow.warehouseApproval).toBe('Warehouse Approval');
    expect(getDictionary('ar').workflow.warehouseApproval).toBe('موافقة المخزن');
    expect(getDictionary('en').workflow.sapPoCreated).toBe('SAP PO Created');
    expect(getDictionary('ar').workflow.sapPoCreated).toBe('تم إنشاء PO في SAP');
  });

  it('PR and PO detail pages use WorkflowStepper with documentType', () => {
    expect(prDetail).toContain('<WorkflowStepper');
    expect(prDetail).toContain("from '@/components/workflow'");
    expect(prDetail).toContain('documentType="PR"');
    expect(poDetail).toContain('<WorkflowStepper');
    expect(poDetail).toContain('documentType="PO"');
  });

  it('PO detail does not render legacy stepper markup', () => {
    expect(poDetail).not.toContain('workflow-stepper-list--rtl');
    expect(poDetail).not.toContain('flex-row-reverse');
    expect(poDetail).not.toMatch(/→\s*\{/);
    expect(poDetail).not.toContain('AnimatedWorkflowStepper');
  });

  it('WorkflowStepper supports PO created step label via poCreated', () => {
    expect(stepper).toContain("step.kind === 'created'");
    expect(stepper).toContain('workflow.poCreated');
  });

  it('APRI detail uses WorkflowStepper when workflow exists', () => {
    expect(apriDetail).toContain('<WorkflowStepper');
    expect(apriDetail).toContain('documentType="APRI"');
    expect(apriDetail).toContain('apri.workflowSteps');
  });

  it('localized current and completed labels exist', () => {
    expect(getDictionary('en').workflow.current).toBe('Current');
    expect(getDictionary('en').workflow.completed).toBe('Completed');
    expect(getDictionary('ar').workflow.current).toBe('الحالية');
    expect(getDictionary('ar').workflow.completed).toBe('مكتملة');
    expect(getDictionary('en').workflow.poCreated).toBe('Created');
    expect(getDictionary('ar').workflow.poCreated).toBe('تم الإنشاء');
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
