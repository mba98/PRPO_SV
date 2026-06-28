import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  canEditPurchaseRequest,
  canResubmitPurchaseRequest,
  getPrEditForbiddenMessage,
  isEditablePrStatus,
  normalizePrStatus,
} from '@/lib/prEditPermissions.js';

const procurementA = {
  _id: '507f1f77bcf86cd799439011',
  permissions: [],
  role: { permissions: ['pr.create'] },
};

const procurementB = {
  _id: '507f1f77bcf86cd799439012',
  permissions: [],
  role: { permissions: ['pr.create'] },
};

const originalCreator = {
  _id: '507f1f77bcf86cd799439013',
  permissions: [],
  role: { permissions: [] },
};

const approver = {
  _id: '507f1f77bcf86cd799439014',
  permissions: [],
  role: { permissions: ['pr.approve.whs'] },
};

const adminViewAll = {
  _id: '507f1f77bcf86cd799439015',
  permissions: ['view.all'],
  role: { permissions: [] },
};

const adminSettings = {
  _id: '507f1f77bcf86cd799439016',
  permissions: ['admin.settings'],
  role: { permissions: [] },
};

const basePr = {
  requester: originalCreator._id,
  sapPRDocEntry: null,
};

describe('normalizePrStatus', () => {
  it('normalizes common casings', () => {
    expect(normalizePrStatus('rejected')).toBe('Rejected');
    expect(normalizePrStatus('Rejected')).toBe('Rejected');
    expect(normalizePrStatus('draft')).toBe('Draft');
    expect(normalizePrStatus('creating in sap')).toBe('Creating in SAP');
  });
});

describe('canEditPurchaseRequest — Procurement only', () => {
  it('allows Procurement with pr.create on rejected PR', () => {
    expect(
      canEditPurchaseRequest(procurementA, { ...basePr, status: 'Rejected' }),
    ).toBe(true);
  });

  it('allows another Procurement user who did not create the PR', () => {
    expect(
      canEditPurchaseRequest(procurementB, { ...basePr, status: 'Rejected' }),
    ).toBe(true);
  });

  it('allows Procurement on draft PR', () => {
    expect(canEditPurchaseRequest(procurementA, { ...basePr, status: 'Draft' })).toBe(true);
  });

  it('blocks original creator without pr.create', () => {
    expect(
      canEditPurchaseRequest(originalCreator, { ...basePr, status: 'Rejected' }),
    ).toBe(false);
  });

  it('blocks approver without pr.create', () => {
    expect(
      canEditPurchaseRequest(approver, { ...basePr, status: 'Rejected' }),
    ).toBe(false);
  });

  it('blocks view.all without pr.create', () => {
    expect(
      canEditPurchaseRequest(adminViewAll, { ...basePr, status: 'Rejected' }),
    ).toBe(false);
  });

  it('blocks admin.settings without pr.create', () => {
    expect(
      canEditPurchaseRequest(adminSettings, { ...basePr, status: 'Rejected' }),
    ).toBe(false);
  });

  it('blocks Procurement on approved PR', () => {
    expect(
      canEditPurchaseRequest(procurementA, { ...basePr, status: 'Approved in SAP' }),
    ).toBe(false);
  });

  it('blocks Procurement when SAP PR exists', () => {
    expect(
      canEditPurchaseRequest(procurementA, {
        ...basePr,
        status: 'Rejected',
        sapPRDocEntry: 1001,
      }),
    ).toBe(false);
  });
});

describe('canResubmitPurchaseRequest — Procurement only', () => {
  it('allows Procurement on rejected PR', () => {
    expect(
      canResubmitPurchaseRequest(procurementA, { ...basePr, status: 'Rejected' }),
    ).toBe(true);
  });

  it('allows another Procurement user', () => {
    expect(
      canResubmitPurchaseRequest(procurementB, { ...basePr, status: 'Rejected' }),
    ).toBe(true);
  });

  it('blocks approver without pr.create', () => {
    expect(
      canResubmitPurchaseRequest(approver, { ...basePr, status: 'Rejected' }),
    ).toBe(false);
  });

  it('blocks view.all alone', () => {
    expect(
      canResubmitPurchaseRequest(adminViewAll, { ...basePr, status: 'Rejected' }),
    ).toBe(false);
  });

  it('blocks draft PR', () => {
    expect(canResubmitPurchaseRequest(procurementA, { ...basePr, status: 'Draft' })).toBe(false);
  });
});

describe('getPrEditForbiddenMessage', () => {
  it('returns null when Procurement may edit', () => {
    expect(
      getPrEditForbiddenMessage(procurementA, { ...basePr, status: 'Rejected' }),
    ).toBeNull();
  });

  it('returns permission message for non-Procurement', () => {
    expect(
      getPrEditForbiddenMessage(approver, { ...basePr, status: 'Rejected' }),
    ).toContain('permission');
  });
});

describe('PrDetailView edit/resubmit UI', () => {
  const source = fs.readFileSync(
    path.resolve(process.cwd(), 'components/purchase-requests/PrDetailView.jsx'),
    'utf8',
  );

  it('shows Edit PR when canEdit', () => {
    expect(source).toContain('pr.canEdit');
    expect(source).toContain('PrEditForm');
  });

  it('shows Resubmit for Approval when canResubmit', () => {
    expect(source).toContain('pr.canResubmit');
    expect(source).toContain('prI18n.resubmit');
  });

  it('shows returned-to-Procurement message for view-only users', () => {
    expect(source).toContain('returnedToProcurement');
  });
});

describe('CreatePoFromPrPanel pre-create form', () => {
  const source = fs.readFileSync(
    path.resolve(process.cwd(), 'components/purchase-requests/CreatePoFromPrPanel.jsx'),
    'utf8',
  );

  it('does not create PO on vendor select', () => {
    expect(source).toContain('PoBusinessFields');
    expect(source).toContain('initializeDraft');
    expect(source).toContain('handleVendorSelect');
    expect(source).not.toMatch(/onSelect[\s\S]{0,200}apiFetch/);
    expect(source).toContain('handleCreate');
  });

  it('shows full form after vendor selection via draft state', () => {
    expect(source).toContain('buildPoDraftFromPr');
    expect(source).toContain('{draft &&');
  });

  it('prevents double submission', () => {
    expect(source).toContain('if (submitting');
    expect(source).toContain('loading={submitting}');
  });
});

describe('PoEditForm uses shared fields', () => {
  const source = fs.readFileSync(
    path.resolve(process.cwd(), 'components/purchase-orders/PoEditForm.jsx'),
    'utf8',
  );

  it('reuses PoBusinessFields', () => {
    expect(source).toContain('PoBusinessFields');
  });
});
