import { describe, expect, it } from 'vitest';
import {
  APRI_STATUS,
  apriStatusInQuery,
  apriStatusLabel,
  apriStatusesEqual,
  isApriReadyForSapCreation,
  normalizeApriStatus,
  pendingApriStatusForStep,
} from '@/lib/apriStatus.js';
import {
  userCanCreateApriInSap,
  userCanEditApriQuantities,
} from '@/lib/apReserveInvoicesService.js';
import {
  CREATE_IN_SAP_BLOCK_REASON,
  resolveApriSapCreationAccess,
  userIsApriOwner,
} from '@/lib/apriSapAuthorization.js';
import { rejectedStatusForDocumentType } from '@/lib/approvalTransition.js';
import { getStateAfterApproval } from '@/lib/approvalEngine.js';

const PROC_USER = { _id: 'proc1', permissions: ['apinvoice.create', 'apri.create.sap'] };
const OTHER_PROC = { _id: 'proc2', permissions: ['apinvoice.create', 'apri.create.sap'] };
const FINANCE_USER = { _id: 'fin1', permissions: ['apinvoice.create', 'po.approve.finance'] };
const VIEW_ALL_USER = { _id: 'admin1', permissions: ['view.all'] };
const ADMIN_USER = { _id: 'admin2', permissions: ['admin.settings', 'apri.create.sap'] };
const WHS_USER = { _id: 'whs1', permissions: ['pr.approve.whs'] };

function readyApri(status, createdBy = 'proc1') {
  return {
    status,
    createdBy,
    relatedPOId: 'po1',
    sapAPDocEntry: null,
    sapAPDocNum: null,
    lines: [{ _id: 'l1', quantity: 1, remainingPoQuantity: 5, poQuantity: 5 }],
  };
}

describe('apriStatus', () => {
  it('normalizes legacy warehouse pending status', () => {
    expect(normalizeApriStatus('Pending Warehouse Approval')).toBe(APRI_STATUS.PENDING_WAREHOUSE);
    expect(apriStatusesEqual('Rejected', APRI_STATUS.WAREHOUSE_REJECTED)).toBe(true);
    expect(apriStatusesEqual('Approved', APRI_STATUS.WAREHOUSE_APPROVED)).toBe(true);
  });

  it('maps matrix permission to pending warehouse', () => {
    expect(
      pendingApriStatusForStep({ requiredPermission: 'apri.approve.whs', stepName: 'Warehouse Approval' }),
    ).toBe(APRI_STATUS.PENDING_WAREHOUSE);
    expect(
      pendingApriStatusForStep({ requiredPermission: 'pr.approve.whs', stepName: 'Warehouse Approval' }),
    ).toBe(APRI_STATUS.PENDING_WAREHOUSE);
  });

  it('labels stable keys for display', () => {
    expect(apriStatusLabel(APRI_STATUS.WAREHOUSE_APPROVED)).toBe('Warehouse Approved');
  });

  it('builds query variants for legacy and stable statuses', () => {
    const query = apriStatusInQuery(APRI_STATUS.WAREHOUSE_APPROVED);
    expect(query.$in).toContain('warehouse_approved');
    expect(query.$in).toContain('Approved');
  });
});

describe('APRI Phase 2 workflow helpers', () => {
  const APRI_STEPS = [{ stepOrder: 1, requiredPermission: 'apri.approve.whs' }];

  it('warehouse final approval transitions to warehouse_approved without SAP status', () => {
    const after = getStateAfterApproval(APRI_STEPS, 1, 'APRI');
    expect(after.status).toBe(APRI_STATUS.WAREHOUSE_APPROVED);
    expect(after.isFinal).toBe(true);
    expect(after.currentApprovalStep).toBe(0);
  });

  it('warehouse rejection uses warehouse_rejected', () => {
    expect(rejectedStatusForDocumentType('APRI')).toBe(APRI_STATUS.WAREHOUSE_REJECTED);
  });

  it('allows procurement SAP creation after warehouse approval', () => {
    const apri = readyApri(APRI_STATUS.WAREHOUSE_APPROVED);
    expect(userCanCreateApriInSap(PROC_USER, apri)).toBe(true);
    expect(userCanCreateApriInSap(WHS_USER, apri)).toBe(false);
    expect(userCanCreateApriInSap(FINANCE_USER, apri)).toBe(false);
    expect(userCanCreateApriInSap(VIEW_ALL_USER, apri)).toBe(false);
  });

  it('denies unrelated procurement user with apri.create.sap', () => {
    const apri = readyApri(APRI_STATUS.WAREHOUSE_APPROVED, 'proc1');
    expect(userCanCreateApriInSap(OTHER_PROC, apri)).toBe(false);
  });

  it('allows admin.settings with apri.create.sap on any owned workflow APRI', () => {
    const apri = readyApri(APRI_STATUS.WAREHOUSE_APPROVED, 'proc1');
    expect(userCanCreateApriInSap(ADMIN_USER, apri)).toBe(true);
  });

  it('blocks SAP creation after warehouse rejection until resubmitted and approved', () => {
    const apri = readyApri(APRI_STATUS.WAREHOUSE_REJECTED);
    expect(isApriReadyForSapCreation(apri.status)).toBe(false);
    expect(userCanCreateApriInSap(PROC_USER, apri)).toBe(false);
    expect(userCanCreateApriInSap(FINANCE_USER, apri)).toBe(false);
  });

  it('blocks SAP creation while pending warehouse', () => {
    const apri = readyApri(APRI_STATUS.PENDING_WAREHOUSE);
    expect(userCanCreateApriInSap(PROC_USER, apri)).toBe(false);
    expect(userCanCreateApriInSap(VIEW_ALL_USER, apri)).toBe(false);
  });

  it('allows quantity edit only for warehouse rejected owner', () => {
    const apri = {
      status: APRI_STATUS.WAREHOUSE_REJECTED,
      createdBy: 'proc1',
      sapAPDocEntry: null,
    };
    expect(userCanEditApriQuantities(PROC_USER, apri)).toBe(true);
    expect(userCanEditApriQuantities(WHS_USER, apri)).toBe(false);
  });

  it('disables quantity edit after warehouse approval', () => {
    const apri = {
      status: APRI_STATUS.WAREHOUSE_APPROVED,
      createdBy: 'proc1',
    };
    expect(userCanEditApriQuantities(PROC_USER, apri)).toBe(false);
  });

  it('returns block reason when permission is missing', () => {
    const apri = readyApri(APRI_STATUS.WAREHOUSE_APPROVED);
    const access = resolveApriSapCreationAccess(WHS_USER, apri);
    expect(access.canCreateInSap).toBe(false);
    expect(access.createInSapBlockReason).toBe(CREATE_IN_SAP_BLOCK_REASON.MISSING_PERMISSION);
  });

  it('returns block reason when user is not document owner', () => {
    const apri = readyApri(APRI_STATUS.WAREHOUSE_APPROVED, 'proc1');
    const access = resolveApriSapCreationAccess(OTHER_PROC, apri);
    expect(access.canCreateInSap).toBe(false);
    expect(access.createInSapBlockReason).toBe(CREATE_IN_SAP_BLOCK_REASON.NOT_DOCUMENT_OWNER);
  });

  it('normalizes owner comparison for populated createdBy', () => {
    const apri = readyApri(APRI_STATUS.WAREHOUSE_APPROVED, { _id: 'proc1', name: 'Proc User' });
    expect(userIsApriOwner({ _id: 'proc1' }, apri)).toBe(true);
    expect(userIsApriOwner({ id: 'proc1' }, apri)).toBe(true);
  });
});
