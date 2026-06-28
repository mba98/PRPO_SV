import { describe, expect, it } from 'vitest';
import {
  PO_EDIT_FORBIDDEN_MESSAGE,
  canEditPurchaseOrder,
  canResubmitPurchaseOrder,
  getPoEditForbiddenMessage,
  hasAnyApprovedApprovalStep,
} from '@/lib/poEditPermissions';
import { PO_STATUS } from '@/lib/poStatus';

const procurement = { permissions: [], role: { permissions: ['po.create'] } };
const procurementB = { _id: 'proc2', permissions: [], role: { permissions: ['po.create'] } };
const pmUser = { permissions: [], role: { permissions: ['po.approve.pm'] } };
const viewAll = { permissions: ['view.all'] };
const adminSettings = { permissions: ['admin.settings'] };

const basePo = { sapPODocEntry: null };

describe('hasAnyApprovedApprovalStep', () => {
  it('detects approved workflow steps', () => {
    expect(
      hasAnyApprovedApprovalStep([
        { action: 'Created' },
        { action: 'Approved', stepName: 'Project Manager Approval' },
      ]),
    ).toBe(true);
  });

  it('ignores rejections and edits', () => {
    expect(
      hasAnyApprovedApprovalStep([
        { action: 'Rejected' },
        { action: 'Updated' },
      ]),
    ).toBe(false);
  });
});

describe('canEditPurchaseOrder', () => {
  it('allows procurement before PM approval on pending_pm', () => {
    expect(
      canEditPurchaseOrder(procurement, { ...basePo, status: PO_STATUS.PENDING_PM }, []),
    ).toBe(true);
  });

  it('blocks procurement on pending_om after PM approval', () => {
    expect(
      canEditPurchaseOrder(
        procurement,
        { ...basePo, status: PO_STATUS.PENDING_OM },
        [{ action: 'Approved', stepName: 'PM' }],
      ),
    ).toBe(false);
  });

  it('blocks procurement when pending_pm but approval history shows PM approved', () => {
    expect(
      canEditPurchaseOrder(
        procurement,
        { ...basePo, status: PO_STATUS.PENDING_PM },
        [{ action: 'Approved', stepName: 'PM' }],
      ),
    ).toBe(false);
  });

  it('allows procurement after rejection', () => {
    expect(
      canEditPurchaseOrder(procurement, { ...basePo, status: PO_STATUS.REJECTED }, [
        { action: 'Approved' },
        { action: 'Rejected' },
      ]),
    ).toBe(true);
  });

  it('blocks non-procurement roles', () => {
    expect(
      canEditPurchaseOrder(pmUser, { ...basePo, status: PO_STATUS.PENDING_PM }, []),
    ).toBe(false);
    expect(
      canEditPurchaseOrder(viewAll, { ...basePo, status: PO_STATUS.PENDING_PM }, []),
    ).toBe(false);
    expect(
      canEditPurchaseOrder(adminSettings, { ...basePo, status: PO_STATUS.REJECTED }, []),
    ).toBe(false);
  });

  it('blocks procurement on post-approval statuses', () => {
    for (const status of [
      PO_STATUS.PENDING_FINANCE,
      PO_STATUS.APPROVED,
      PO_STATUS.CREATING_IN_SAP,
      PO_STATUS.CREATED_IN_SAP,
      PO_STATUS.FAILED_SAP,
      PO_STATUS.CANCELLED,
    ]) {
      expect(canEditPurchaseOrder(procurement, { ...basePo, status }, [])).toBe(false);
    }
  });
});

describe('canResubmitPurchaseOrder', () => {
  it('allows Procurement on rejected PO', () => {
    expect(
      canResubmitPurchaseOrder(procurement, { ...basePo, status: PO_STATUS.REJECTED }, []),
    ).toBe(true);
  });

  it('allows another Procurement user', () => {
    expect(
      canResubmitPurchaseOrder(procurementB, { ...basePo, status: PO_STATUS.REJECTED }, []),
    ).toBe(true);
  });

  it('blocks approver without po.create', () => {
    expect(
      canResubmitPurchaseOrder(pmUser, { ...basePo, status: PO_STATUS.REJECTED }, []),
    ).toBe(false);
  });

  it('blocks view.all without po.create', () => {
    expect(
      canResubmitPurchaseOrder(viewAll, { ...basePo, status: PO_STATUS.REJECTED }, []),
    ).toBe(false);
  });
});

describe('getPoEditForbiddenMessage', () => {
  it('returns workflow message for procurement after approval started', () => {
    expect(
      getPoEditForbiddenMessage(
        procurement,
        { ...basePo, status: PO_STATUS.PENDING_OM },
        [],
      ),
    ).toBe(PO_EDIT_FORBIDDEN_MESSAGE);
  });

  it('returns permission message for non-procurement', () => {
    expect(
      getPoEditForbiddenMessage(pmUser, { ...basePo, status: PO_STATUS.PENDING_PM }, []),
    ).toContain('permission');
  });
});
