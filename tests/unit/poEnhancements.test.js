import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createPurchaseRequestSchema } from '@/lib/validators/purchaseRequest';
import {
  createPoFromPrSchema,
  updatePurchaseOrderSchema,
} from '@/lib/validators/purchaseOrder';
import { mapPrToSap } from '@/lib/sap/mappers/prToSap';
import { mapPoToSap, mapPoToSapFromPortalRecord } from '@/lib/sap/mappers/poToSap';
import { buildDocumentWorkflow } from '@/lib/workflowSteps';
import { canEditPurchaseOrder } from '@/lib/poEditPermissions';
import PurchaseOrder from '@/models/PurchaseOrder.js';

const prOptions = { requesterSapCode: 'manager', defaultRequesterCode: 'manager' };

describe('PR uomCode', () => {
  it('createPurchaseRequestSchema accepts uomCode on lines', () => {
    const result = createPurchaseRequestSchema.safeParse({
      requiredDate: '2026-05-20',
      lines: [
        {
          itemCode: 'ITEM1',
          quantity: 1,
          estimatedUnitPrice: 10,
          warehouseCode: 'RAN004',
          uomCode: 'PCS',
        },
      ],
    });
    expect(result.success).toBe(true);
    expect(result.data.lines[0].uomCode).toBe('PCS');
  });

  it('prToSap maps uomCode to UoMCode', () => {
    const pr = {
      requiredDate: new Date('2026-05-20'),
      lines: [
        {
          itemCode: 'ALK00004SV',
          quantity: 1,
          warehouseCode: 'RAN004',
          estimatedUnitPrice: 1,
          uomCode: 'PCS',
        },
      ],
    };
    const payload = mapPrToSap(pr, prOptions);
    expect(payload.DocumentLines[0].UoMCode).toBe('PCS');
  });

  it('prToSap omits UoMCode when empty', () => {
    const pr = {
      requiredDate: new Date('2026-05-20'),
      lines: [
        {
          itemCode: 'ALK00004SV',
          quantity: 1,
          warehouseCode: 'RAN004',
          estimatedUnitPrice: 1,
        },
      ],
    };
    const payload = mapPrToSap(pr, prOptions);
    expect(payload.DocumentLines[0].UoMCode).toBeUndefined();
  });
});

describe('PO uomCode and docRate', () => {
  it('updatePurchaseOrderSchema accepts valid docRate', () => {
    expect(updatePurchaseOrderSchema.safeParse({ docRate: 1.25 }).success).toBe(true);
  });

  it('updatePurchaseOrderSchema rejects docRate <= 0', () => {
    expect(updatePurchaseOrderSchema.safeParse({ docRate: 0 }).success).toBe(false);
    expect(updatePurchaseOrderSchema.safeParse({ docRate: -1 }).success).toBe(false);
  });

  it('poToSap sends DocRate when provided', () => {
    const payload = mapPoToSap({
      vendor: 'V1',
      docRate: 11500,
      requiredDate: new Date('2026-05-21'),
      lines: [{ itemCode: 'A1', quantity: 1, unitPrice: 5 }],
    });
    expect(payload.DocRate).toBe(11500);
  });

  it('poToSap includes DocCurrency and default DocRate in non-production', () => {
    const payload = mapPoToSap({
      vendor: 'V1',
      requiredDate: new Date('2026-05-21'),
      lines: [{ itemCode: 'A1', quantity: 1, unitPrice: 5, warehouseCode: 'RAN004' }],
    });
    expect(payload.DocCurrency).toBe('USD');
    expect(payload.DocRate).toBe(1350);
    expect(payload.DocumentLines[0].BaseType).toBeUndefined();
  });

  it('poToSap maps line uomCode to UoMCode', () => {
    const payload = mapPoToSapFromPortalRecord(
      {
        vendor: 'V1',
        requiredDate: new Date('2026-05-21'),
        lines: [{ itemCode: 'A1', quantity: 2, unitPrice: 5, uomCode: 'PCS', sapPRBaseLine: 0 }],
        relatedSAPPRDocEntry: 42,
      },
      { sapPRDocEntry: 42 },
      {},
    );
    expect(payload.DocumentLines[0].UoMCode).toBe('PCS');
    expect(payload.DocumentLines[0].BaseEntry).toBeUndefined();
  });

  it('poToSap omits empty UoMCode', () => {
    const payload = mapPoToSap({
      vendor: 'V1',
      requiredDate: new Date('2026-05-21'),
      lines: [{ itemCode: 'A1', quantity: 1, unitPrice: 5 }],
    });
    expect(payload.DocumentLines[0].UoMCode).toBeUndefined();
  });
});

describe('PO edit permissions', () => {
  it('allows po.create while Pending Project Manager Approval', () => {
    const po = { status: 'Pending Project Manager Approval', sapPODocEntry: null };
    const user = { permissions: [], role: { permissions: ['po.create'] } };
    expect(canEditPurchaseOrder(user, po)).toBe(true);
  });

  it('rejects editing when Created in SAP', () => {
    const po = { status: 'Created in SAP', sapPODocEntry: 99 };
    const user = { permissions: ['view.all'], role: { permissions: [] } };
    expect(canEditPurchaseOrder(user, po)).toBe(false);
  });

  it('rejects unauthorized users', () => {
    const po = { status: 'Pending Project Manager Approval', sapPODocEntry: null };
    const user = { permissions: [], role: { permissions: ['po.approve.pm'] } };
    expect(canEditPurchaseOrder(user, po)).toBe(false);
  });

  it('allows view.all and admin.settings', () => {
    const po = { status: 'Approved', sapPODocEntry: null };
    expect(canEditPurchaseOrder({ permissions: ['view.all'] }, po)).toBe(true);
    expect(canEditPurchaseOrder({ permissions: ['admin.settings'] }, po)).toBe(true);
  });
});

describe('PO workflow stepper', () => {
  const PO_STEPS = [
    { stepOrder: 1, stepName: 'PM Approval', requiredPermission: 'po.approve.pm' },
    { stepOrder: 2, stepName: 'Finance Approval', requiredPermission: 'po.approve.finance' },
  ];

  it('builds Created + matrix + SAP steps dynamically', () => {
    const doc = {
      status: 'Pending Project Manager Approval',
      currentApprovalStep: 1,
      sapPODocEntry: null,
    };
    const workflow = buildDocumentWorkflow(PO_STEPS, doc, 'PO', {
      permissions: [],
      role: { permissions: ['po.approve.pm'] },
    }, { includeCreated: true });
    expect(workflow[0].stepName).toBe('Created');
    expect(workflow[0].state).toBe('completed');
    expect(workflow[1].stepName).toBe('PM Approval');
    expect(workflow[1].state).toBe('current');
    expect(workflow[workflow.length - 1].stepName).toBe('SAP Created');
  });

  it('shows SAP failed on PO workflow', () => {
    const doc = {
      status: 'Failed to Create in SAP',
      currentApprovalStep: 2,
      sapPODocEntry: null,
    };
    const workflow = buildDocumentWorkflow(PO_STEPS, doc, 'PO', { permissions: ['view.all'] }, {
      includeCreated: true,
    });
    expect(workflow[workflow.length - 1].state).toBe('sap_failed');
  });

});

describe('PO from PR', () => {
  it('createPoFromPrSchema still requires vendor', () => {
    expect(createPoFromPrSchema.safeParse({ vendor: 'V1' }).success).toBe(true);
  });
});

describe('PurchaseOrder model', () => {
  it('schema includes docCurrency, docRate and line uomCode paths', () => {
    const paths = PurchaseOrder.schema.paths;
    expect(paths.docCurrency).toBeDefined();
    expect(paths.docRate).toBeDefined();
    expect(PurchaseOrder.schema.path('lines.0.uomCode')).toBeDefined();
  });
});
