import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getDictionary } from '@/lib/i18n';

describe('PoEditForm compact layout', () => {
  const source = fs.readFileSync(
    path.resolve(process.cwd(), 'components/purchase-orders/PoEditForm.jsx'),
    'utf8',
  );
  const poDetail = fs.readFileSync(
    path.resolve(process.cwd(), 'components/purchase-orders/PoDetailView.jsx'),
    'utf8',
  );

  it('uses compact header card and grid', () => {
    expect(source).toContain('rounded-3xl border border-border bg-card');
    expect(source).toContain('sm:grid-cols-2 lg:grid-cols-3');
    expect(source).toContain('FormField');
    expect(source).toContain('input-field-compact');
  });

  it('renders line items as compact rows without line remarks input', () => {
    expect(source).toContain('LINE_GRID');
    expect(source).toContain('rounded-2xl border border-border bg-muted/20');
    expect(source).not.toMatch(/line\.remarks[\s\S]*<input/);
    expect(source).toContain('remarks: l.remarks');
  });

  it('uses VendorSelect and save Button loading state', () => {
    expect(source).toContain('VendorSelect');
    expect(source).toContain('loadAllOnFocus');
    expect(source).toContain('loading={saving}');
    expect(source).toContain('t.saving');
  });

  it('defaults empty docRate to DEV_DEFAULT_PO_DOC_RATE in form state only', () => {
    expect(source).toContain('DEV_DEFAULT_PO_DOC_RATE');
    expect(source).toContain('resolveFormDocRate');
    expect(source).toContain('docRate: resolveFormDocRate(po)');
  });

  it('PO detail embeds PoEditForm and WorkflowStepper', () => {
    expect(poDetail).toContain('<PoEditForm');
    expect(poDetail).toContain('<WorkflowStepper');
    expect(poDetail).toContain('documentType="PO"');
    expect(poDetail).not.toContain('AnimatedWorkflowStepper');
  });
});

describe('PO edit i18n', () => {
  it('has English and Arabic edit labels', () => {
    expect(getDictionary('en').po.edit.title).toBe('Edit purchase order');
    expect(getDictionary('en').po.edit.saveChanges).toBe('Save changes');
    expect(getDictionary('ar').po.edit.title).toBe('تعديل أمر الشراء');
    expect(getDictionary('ar').po.edit.saving).toContain('جاري');
  });
});

describe('PO workflow stepper layout', () => {
  const stepper = fs.readFileSync(
    path.resolve(process.cwd(), 'components/workflow/WorkflowStepper.jsx'),
    'utf8',
  );
  const css = fs.readFileSync(path.resolve(process.cwd(), 'app/globals.css'), 'utf8');

  it('uses dir=rtl for Arabic without reversing computed steps', () => {
    expect(stepper).toContain('const computedSteps = steps.map');
    expect(stepper).toContain('const flowDir = isRtl ? \'rtl\' : \'ltr\'');
    expect(stepper).not.toContain('[...computedSteps].reverse()');
  });

  it('uses compact step cards and themed connectors', () => {
    expect(css).toContain('min-w-[9.5rem]');
    expect(css).toContain('workflow-connector-chevron');
    expect(css).toContain('var(--primary)');
    expect(stepper).toContain('x: isRtl ? [0, -4, 0] : [0, 4, 0]');
  });

  it('PO workflow labels include finance and SAP steps', () => {
    expect(getDictionary('en').workflow.projectManagerApproval).toBe('Project Manager Approval');
    expect(getDictionary('en').workflow.financeApproval).toBe('Finance Approval');
    expect(getDictionary('en').workflow.sapPoCreated).toBe('SAP PO Created');
    expect(getDictionary('ar').workflow.financeApproval).toBe('موافقة المالية');
  });
});
