import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  LP_STATUS,
  lpStatusLabel,
  pendingLpStatusForStep,
} from '@/lib/localPurchaseStatus.js';
import {
  recalculateLpDocumentTotal,
  recalculateLpLines,
  sanitizeLocalPurchase,
  sanitizeLpLine,
} from '@/lib/localPurchasesService.js';
import {
  userCanEditLocalPurchase,
  userCanViewLocalPurchase,
  userHasAnyLpApprovalPermission,
} from '@/lib/localPurchasePermissions.js';
import { getInitialSubmitState, getStateAfterApproval } from '@/lib/approvalEngine.js';
import { rejectedStatusForDocumentType } from '@/lib/approvalTransition.js';
import { getVisibleNavItems } from '@/lib/navigation.js';
import { statusLabel } from '@/lib/i18n/index.js';
import { createLocalPurchaseSchema } from '@/lib/validators/localPurchase.js';

const PROC_USER = { _id: 'u1', id: 'u1', permissions: ['lp.create'] };
const PM_USER = { _id: 'u2', permissions: ['lp.approve.pm'] };
const VIEW_ALL_USER = { _id: 'u4', permissions: ['lp.view.all'] };
const OTHER_USER = { _id: 'u5', permissions: ['lp.create'] };

const LP_STEPS = [
  { stepOrder: 1, stepName: 'Project Manager Approval', requiredPermission: 'lp.approve.pm' },
  { stepOrder: 2, stepName: 'Finance Approval', requiredPermission: 'lp.approve.finance' },
];

function draftDoc(createdBy = 'u1') {
  return {
    status: LP_STATUS.DRAFT,
    createdBy,
    lines: [{ description: 'Item', quantity: 2, unitPrice: 10, lineTotal: 20 }],
    documentTotal: 20,
  };
}

describe('localPurchaseStatus', () => {
  it('labels English and Arabic statuses', () => {
    expect(lpStatusLabel(LP_STATUS.PENDING_PM, 'en')).toContain('Project Manager');
    expect(lpStatusLabel(LP_STATUS.PENDING_PM, 'ar')).toContain('مدير المشروع');
    expect(statusLabel(LP_STATUS.COMPLETED, 'en')).toBe('Completed');
    expect(statusLabel(LP_STATUS.COMPLETED, 'ar')).toBe('مكتمل');
  });

  it('maps matrix permissions to pending statuses', () => {
    expect(pendingLpStatusForStep({ requiredPermission: 'lp.approve.pm' })).toBe(
      LP_STATUS.PENDING_PM,
    );
    expect(pendingLpStatusForStep({ requiredPermission: 'lp.approve.finance' })).toBe(
      LP_STATUS.PENDING_FINANCE,
    );
  });
});

describe('local purchase calculations', () => {
  it('recalculates line and document totals server-side', () => {
    const lines = recalculateLpLines([
      { description: 'A', quantity: 3, unitPrice: 5 },
      { description: 'B', quantity: 2, unitPrice: 7.5 },
    ]);
    expect(lines[0].lineTotal).toBe(15);
    expect(lines[1].lineTotal).toBe(15);
    expect(recalculateLpDocumentTotal(lines)).toBe(30);
  });

  it('keeps document total independent from header budget', () => {
    const lines = recalculateLpLines([{ description: 'A', quantity: 2, unitPrice: 10 }]);
    const documentTotal = recalculateLpDocumentTotal(lines);
    expect(documentTotal).toBe(20);
    const parsed = createLocalPurchaseSchema.safeParse({
      documentDate: new Date(),
      budget: 5000,
      lines,
    });
    expect(parsed.success).toBe(true);
    expect(parsed.data.budget).toBe(5000);
    expect(documentTotal).not.toBe(parsed.data.budget);
  });

  it('stores budget once at document header level', () => {
    const sanitized = sanitizeLocalPurchase({
      _id: 'lp1',
      portalLPNumber: 'LP-20260101-0001',
      documentDate: new Date('2026-01-01'),
      budget: 2500,
      remarks: 'Test',
      lines: [{ description: 'Widget', quantity: 1, unitPrice: 100, lineTotal: 100 }],
      documentTotal: 100,
      status: LP_STATUS.DRAFT,
    });
    expect(sanitized.budget).toBe(2500);
    expect(sanitized.lines).toHaveLength(1);
    expect(sanitized.lines[0].budget).toBeUndefined();
  });

  it('ignores legacy line-level budget on read', () => {
    const line = sanitizeLpLine({
      description: 'Legacy item',
      quantity: 1,
      unitPrice: 50,
      budget: 999,
      uom: 'EA',
    });
    expect(line.budget).toBeUndefined();
    expect(line.uom).toBeUndefined();
    expect(line.lineTotal).toBe(50);
  });

  it('requires budget in schema', () => {
    const parsed = createLocalPurchaseSchema.safeParse({
      documentDate: new Date(),
      lines: [{ description: 'X', quantity: 1, unitPrice: 1 }],
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects negative budget in schema', () => {
    const parsed = createLocalPurchaseSchema.safeParse({
      documentDate: new Date(),
      budget: -1,
      lines: [{ description: 'X', quantity: 1, unitPrice: 1 }],
    });
    expect(parsed.success).toBe(false);
  });

  it('accepts zero budget in schema', () => {
    const parsed = createLocalPurchaseSchema.safeParse({
      documentDate: new Date(),
      budget: 0,
      lines: [{ description: 'X', quantity: 1, unitPrice: 1 }],
    });
    expect(parsed.success).toBe(true);
  });

  it('line payloads do not include budget field', () => {
    const lines = recalculateLpLines([
      { description: 'A', quantity: 1, unitPrice: 10, budget: 100 },
    ]);
    expect(lines[0]).not.toHaveProperty('budget');
  });

  it('rejects invalid quantity in schema', () => {
    const parsed = createLocalPurchaseSchema.safeParse({
      documentDate: new Date(),
      budget: 100,
      lines: [{ description: 'X', quantity: 0, unitPrice: 1 }],
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects negative unit price in schema', () => {
    const parsed = createLocalPurchaseSchema.safeParse({
      documentDate: new Date(),
      budget: 100,
      lines: [{ description: 'X', quantity: 1, unitPrice: -1 }],
    });
    expect(parsed.success).toBe(false);
  });

  it('defaults currency to IQD in schema', () => {
    const parsed = createLocalPurchaseSchema.safeParse({
      documentDate: new Date(),
      budget: 100,
      lines: [{ description: 'X', quantity: 1, unitPrice: 1 }],
    });
    expect(parsed.success).toBe(true);
    expect(parsed.data.currency).toBe('IQD');
  });

  it('accepts only IQD and USD currency values', () => {
    expect(
      createLocalPurchaseSchema.safeParse({
        documentDate: new Date(),
        currency: 'USD',
        budget: 100,
        lines: [{ description: 'X', quantity: 1, unitPrice: 1 }],
      }).success,
    ).toBe(true);
    expect(
      createLocalPurchaseSchema.safeParse({
        documentDate: new Date(),
        currency: 'EUR',
        budget: 100,
        lines: [{ description: 'X', quantity: 1, unitPrice: 1 }],
      }).success,
    ).toBe(false);
  });

  it('includes currency on sanitized documents', () => {
    const sanitized = sanitizeLocalPurchase({
      _id: 'lp1',
      documentDate: new Date(),
      currency: 'USD',
      budget: 1000,
      lines: [],
      documentTotal: 0,
      status: LP_STATUS.DRAFT,
    });
    expect(sanitized.currency).toBe('USD');
    expect(typeof sanitized.budget).toBe('number');
  });
});

describe('local purchase permissions', () => {
  it('allows creator to edit draft and rejected', () => {
    expect(userCanEditLocalPurchase(PROC_USER, draftDoc())).toBe(true);
    expect(
      userCanEditLocalPurchase(PROC_USER, {
        ...draftDoc(),
        status: LP_STATUS.REJECTED,
      }),
    ).toBe(true);
  });

  it('denies non-owner edit even with lp.create', () => {
    expect(userCanEditLocalPurchase(OTHER_USER, draftDoc('u1'))).toBe(false);
  });

  it('denies edit for pending statuses', () => {
    expect(
      userCanEditLocalPurchase(PROC_USER, {
        ...draftDoc(),
        status: LP_STATUS.PENDING_PM,
      }),
    ).toBe(false);
  });

  it('allows PM to view pending PM documents', () => {
    expect(
      userCanViewLocalPurchase(PM_USER, {
        status: LP_STATUS.PENDING_PM,
        createdBy: 'u1',
      }),
    ).toBe(true);
  });

  it('does not treat lp.view.all alone as edit permission', () => {
    expect(
      userCanEditLocalPurchase(VIEW_ALL_USER, {
        ...draftDoc('u9'),
        status: LP_STATUS.REJECTED,
      }),
    ).toBe(false);
  });

  it('detects approval permissions independently from PO permissions', () => {
    expect(userHasAnyLpApprovalPermission(['lp.approve.pm'])).toBe(true);
    expect(userHasAnyLpApprovalPermission(['po.approve.pm'])).toBe(false);
  });
});

describe('local purchase workflow transitions', () => {
  it('submit moves to first active step', () => {
    const next = getInitialSubmitState(LP_STEPS, 'LOCAL_PURCHASE');
    expect(next.status).toBe(LP_STATUS.PENDING_PM);
    expect(next.currentApprovalStep).toBe(1);
  });

  it('PM approval moves to finance', () => {
    const after = getStateAfterApproval(LP_STEPS, 1, 'LOCAL_PURCHASE');
    expect(after.isFinal).toBe(false);
    expect(after.status).toBe(LP_STATUS.PENDING_FINANCE);
    expect(after.currentApprovalStep).toBe(2);
  });

  it('finance approval completes locally', () => {
    const after = getStateAfterApproval(LP_STEPS, 2, 'LOCAL_PURCHASE');
    expect(after.isFinal).toBe(true);
    expect(after.status).toBe(LP_STATUS.COMPLETED);
  });

  it('rejection uses local purchase rejected status', () => {
    expect(rejectedStatusForDocumentType('LOCAL_PURCHASE')).toBe(LP_STATUS.REJECTED);
  });
});

describe('local purchase SAP isolation', () => {
  it('service module does not import SAP helpers', () => {
    const servicePath = path.resolve(process.cwd(), 'lib/localPurchasesService.js');
    const source = fs.readFileSync(servicePath, 'utf8');
    expect(source).not.toMatch(/from '@\/lib\/sap/);
    expect(source).not.toMatch(/SapIntegrationLog/);
    expect(source).not.toMatch(/createSap/);
  });

  it('model does not define SAP fields', () => {
    const modelPath = path.resolve(process.cwd(), 'models/LocalPurchase.js');
    const source = fs.readFileSync(modelPath, 'utf8');
    expect(source).not.toMatch(/sapDocEntry|sapDocNum|sapStatus|sapError/i);
  });
});

describe('navigation', () => {
  it('shows Local Purchases for LP permissions', () => {
    const items = getVisibleNavItems(['lp.create'], 'en');
    expect(items.some((item) => item.href === '/local-purchases')).toBe(true);
  });

  it('hides Local Purchases without LP permissions', () => {
    const items = getVisibleNavItems(['pr.create'], 'en');
    expect(items.some((item) => item.href === '/local-purchases')).toBe(false);
  });
});

describe('existing workflows unchanged', () => {
  it('PR submit state remains warehouse pending', () => {
    const steps = [{ stepOrder: 1, requiredPermission: 'pr.approve.whs', stepName: 'Warehouse' }];
    const next = getInitialSubmitState(steps, 'PR');
    expect(next.status).toBe('Pending Warehouse Approval');
  });

  it('PO rejection status unchanged', () => {
    expect(rejectedStatusForDocumentType('PO')).toBe('rejected');
  });
});
