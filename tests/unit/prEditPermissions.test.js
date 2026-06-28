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

const requesterId = '507f1f77bcf86cd799439011';
const otherUserId = '507f1f77bcf86cd799439012';

const requester = {
  _id: requesterId,
  permissions: [],
  role: { permissions: ['pr.create'] },
};

const otherRequester = {
  _id: otherUserId,
  permissions: [],
  role: { permissions: ['pr.create'] },
};

const admin = {
  _id: otherUserId,
  permissions: ['view.all'],
  role: { permissions: [] },
};

const basePr = {
  requester: requesterId,
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

describe('isEditablePrStatus', () => {
  it('allows draft and rejected', () => {
    expect(isEditablePrStatus('Draft')).toBe(true);
    expect(isEditablePrStatus('rejected')).toBe(true);
  });

  it('blocks approved and pending statuses', () => {
    expect(isEditablePrStatus('Approved in SAP')).toBe(false);
    expect(isEditablePrStatus('Pending Warehouse Approval')).toBe(false);
  });
});

describe('canEditPurchaseRequest', () => {
  it('allows original requester on rejected PR', () => {
    expect(
      canEditPurchaseRequest(requester, { ...basePr, status: 'Rejected' }),
    ).toBe(true);
  });

  it('allows original requester on draft PR', () => {
    expect(canEditPurchaseRequest(requester, { ...basePr, status: 'Draft' })).toBe(true);
  });

  it('blocks another requester on rejected PR', () => {
    expect(
      canEditPurchaseRequest(otherRequester, { ...basePr, status: 'Rejected' }),
    ).toBe(false);
  });

  it('blocks requester on approved PR', () => {
    expect(
      canEditPurchaseRequest(requester, { ...basePr, status: 'Approved in SAP' }),
    ).toBe(false);
  });

  it('blocks requester when SAP PR exists', () => {
    expect(
      canEditPurchaseRequest(requester, {
        ...basePr,
        status: 'Rejected',
        sapPRDocEntry: 1001,
      }),
    ).toBe(false);
  });

  it('blocks requester while SAP creation is in progress', () => {
    expect(
      canEditPurchaseRequest(requester, {
        ...basePr,
        status: 'Creating in SAP',
      }),
    ).toBe(false);
  });

  it('allows admin on rejected PR', () => {
    expect(
      canEditPurchaseRequest(admin, { ...basePr, status: 'Rejected' }),
    ).toBe(true);
  });
});

describe('canResubmitPurchaseRequest', () => {
  it('allows original requester on rejected PR', () => {
    expect(
      canResubmitPurchaseRequest(requester, { ...basePr, status: 'Rejected' }),
    ).toBe(true);
  });

  it('blocks another requester', () => {
    expect(
      canResubmitPurchaseRequest(otherRequester, { ...basePr, status: 'Rejected' }),
    ).toBe(false);
  });

  it('blocks admin even with view.all', () => {
    expect(
      canResubmitPurchaseRequest(admin, { ...basePr, status: 'Rejected' }),
    ).toBe(false);
  });

  it('blocks draft PR', () => {
    expect(canResubmitPurchaseRequest(requester, { ...basePr, status: 'Draft' })).toBe(false);
  });

  it('blocks when SAP PR exists', () => {
    expect(
      canResubmitPurchaseRequest(requester, {
        ...basePr,
        status: 'Rejected',
        sapPRDocEntry: 42,
      }),
    ).toBe(false);
  });
});

describe('getPrEditForbiddenMessage', () => {
  it('returns null when edit is allowed', () => {
    expect(
      getPrEditForbiddenMessage(requester, { ...basePr, status: 'Rejected' }),
    ).toBeNull();
  });

  it('returns permission message for non-owner', () => {
    expect(
      getPrEditForbiddenMessage(otherRequester, { ...basePr, status: 'Rejected' }),
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
    expect(source).toContain('/submit');
  });
});

describe('PrEditForm loads existing values', () => {
  const source = fs.readFileSync(
    path.resolve(process.cwd(), 'components/purchase-requests/PrEditForm.jsx'),
    'utf8',
  );

  it('maps header and line fields from PR', () => {
    expect(source).toContain('pr.requiredDate');
    expect(source).toContain('pr.lines');
    expect(source).toContain('mapLineFromPr');
  });
});

describe('ApprovalHistory Resubmitted action', () => {
  const source = fs.readFileSync(
    path.resolve(process.cwd(), 'models/ApprovalHistory.js'),
    'utf8',
  );

  it('includes Resubmitted in action enum', () => {
    expect(source).toContain("'Resubmitted'");
  });
});
