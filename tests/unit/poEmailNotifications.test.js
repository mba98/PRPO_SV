import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildWorkflowEmail } from '@/lib/emailTemplates.js';
import { PO_STATUS } from '@/lib/poStatus.js';

const PO_STEPS = [
  {
    stepOrder: 1,
    stepName: 'Project Manager Approval',
    requiredPermission: 'po.approve.pm',
    approverRole: { _id: 'role-pm', name: 'Project Manager' },
  },
  {
    stepOrder: 2,
    stepName: 'Operation Manager Approval',
    requiredPermission: 'po.approve.om',
    approverRole: { _id: 'role-om', name: 'Operation Manager' },
  },
  {
    stepOrder: 3,
    stepName: 'Finance Approval',
    requiredPermission: 'po.approve.finance',
    approverRole: { _id: 'role-fin', name: 'Finance' },
  },
];

const mocks = vi.hoisted(() => ({
  findById: vi.fn(),
  notifyWorkflowEmailSafe: vi.fn(),
  createSapPurchaseOrder: vi.fn(),
  resolveApprovalStepRecipientEmails: vi.fn(),
  logStepApprovalHistory: vi.fn(),
  emailGroupFindOne: vi.fn(),
  roleFind: vi.fn(),
  userFind: vi.fn(),
  userFindById: vi.fn(),
  sendEmail: vi.fn(),
}));

vi.mock('@/lib/mongodb', () => ({
  connectDB: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/models/index.js', () => ({}));

vi.mock('@/models/PurchaseOrder.js', () => ({
  default: { findById: (...args) => mocks.findById(...args) },
}));

vi.mock('@/lib/approvalEngine.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getApprovalSteps: vi.fn().mockResolvedValue(PO_STEPS),
  };
});

vi.mock('@/lib/approvalTransition.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    atomicDocumentStepTransition: vi.fn().mockImplementation(async (_Model, _filter, setFields) => ({
      _id: { toString: () => 'poid1' },
      portalPONumber: 'PO-TEST-001',
      status: setFields.status,
      currentApprovalStep: setFields.currentApprovalStep,
      toObject() {
        return {
          _id: { toString: () => 'poid1' },
          portalPONumber: 'PO-TEST-001',
          status: this.status,
          currentApprovalStep: this.currentApprovalStep,
        };
      },
    })),
  };
});

vi.mock('@/lib/emailNotify.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    notifyWorkflowEmailSafe: (...args) => mocks.notifyWorkflowEmailSafe(...args),
  };
});

vi.mock('@/lib/sap/poSap.js', () => ({
  createSapPurchaseOrder: (...args) => mocks.createSapPurchaseOrder(...args),
  retrySapPurchaseOrder: vi.fn(),
}));

vi.mock('@/lib/lpEmailRecipients.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    resolveApprovalStepRecipientEmails: (...args) =>
      mocks.resolveApprovalStepRecipientEmails(...args),
  };
});

vi.mock('@/lib/auditHistory.js', () => ({
  logStepApprovalHistory: (...args) => mocks.logStepApprovalHistory(...args),
  logApprovalHistory: vi.fn(),
  getApprovalHistory: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/models/EmailGroup.js', () => ({
  default: { findOne: mocks.emailGroupFindOne },
}));

vi.mock('@/models/Role.js', () => ({
  default: { find: mocks.roleFind },
}));

vi.mock('@/models/User.js', () => ({
  default: {
    find: mocks.userFind,
    findById: mocks.userFindById,
  },
}));

vi.mock('@/lib/email.js', () => ({
  sendEmail: (...args) => mocks.sendEmail(...args),
}));

function mockQueryChain(rows = []) {
  const lean = vi.fn().mockResolvedValue(rows);
  const select = vi.fn().mockReturnValue({ lean, populate: vi.fn().mockReturnValue({ lean }) });
  const populate = vi.fn().mockReturnValue({ select, lean });
  return { select, populate, lean };
}

function makePoDoc(overrides = {}) {
  return {
    _id: { toString: () => 'poid1' },
    portalPONumber: 'PO-TEST-001',
    status: overrides.status ?? PO_STATUS.PENDING_PM,
    currentApprovalStep: overrides.currentApprovalStep ?? 1,
    __v: 0,
    toObject() {
      return {
        _id: { toString: () => 'poid1' },
        portalPONumber: 'PO-TEST-001',
        status: this.status,
        currentApprovalStep: this.currentApprovalStep,
        __v: this.__v,
      };
    },
    ...overrides,
  };
}

describe('PO email templates', () => {
  const templateData = {
    portalPONumber: 'PO-2026-0001',
    documentId: '507f1f77bcf86cd799439011',
  };

  it('po.pm.approved targets Operation Manager wording', () => {
    const { subject, html, text } = buildWorkflowEmail('po.pm.approved', templateData);
    expect(subject).toBe('PO PO-2026-0001 approved — pending Operation Manager');
    expect(html).toContain('Pending Operation Manager Approval');
    expect(text).toContain('operation manager approval');
    expect(html).not.toContain('Pending Finance Approval');
    expect(text).not.toMatch(/pending finance/i);
  });

  it('po.om.approved targets Finance wording', () => {
    const { subject, html, text } = buildWorkflowEmail('po.om.approved', templateData);
    expect(subject).toBe('PO PO-2026-0001 approved by Operation Manager — pending Finance');
    expect(html).toContain('Pending Finance Approval');
    expect(text).toContain('finance approval');
    expect(html).toContain('operation manager');
  });
});

describe('PO approval email notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.logStepApprovalHistory.mockResolvedValue(undefined);
    mocks.createSapPurchaseOrder.mockResolvedValue({ success: true });
    mocks.emailGroupFindOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
    });
    mocks.roleFind.mockReturnValue(mockQueryChain([]));
    mocks.userFind.mockReturnValue(mockQueryChain([]));
    mocks.sendEmail.mockResolvedValue({ success: true });
    mocks.resolveApprovalStepRecipientEmails.mockImplementation(async (step) => {
      if (step?.requiredPermission === 'po.approve.om') {
        return { emails: ['om@example.com'], eligibleUsers: 1 };
      }
      if (step?.requiredPermission === 'po.approve.finance') {
        return { emails: ['finance@example.com'], eligibleUsers: 1 };
      }
      return { emails: [], eligibleUsers: 0 };
    });
  });

  it('PM approval moves to pending_om and notifies po.pm.approved once for OM', async () => {
    const po = makePoDoc({
      status: PO_STATUS.PENDING_PM,
      currentApprovalStep: 1,
    });
    mocks.findById.mockResolvedValue(po);

    const { approvePurchaseOrder } = await import('@/lib/purchaseOrdersService.js');
    const user = {
      _id: 'u-pm',
      name: 'PM User',
      permissions: ['po.approve.pm'],
      roleName: 'Project Manager',
    };

    await approvePurchaseOrder('poid1', user, { comment: 'ok', __v: 0 });

    expect(mocks.notifyWorkflowEmailSafe).toHaveBeenCalledTimes(1);
    expect(mocks.notifyWorkflowEmailSafe).toHaveBeenCalledWith(
      'po.pm.approved',
      expect.objectContaining({
        portalPONumber: 'PO-TEST-001',
        status: PO_STATUS.PENDING_OM,
        stepRecipientEmails: ['om@example.com'],
        requiredPermission: 'po.approve.om',
      }),
      { documentType: 'PO', documentId: 'poid1' },
    );
    expect(mocks.createSapPurchaseOrder).not.toHaveBeenCalled();
  });

  it('OM approval moves to pending_finance and notifies po.om.approved once for Finance', async () => {
    const po = makePoDoc({
      status: PO_STATUS.PENDING_OM,
      currentApprovalStep: 2,
    });
    mocks.findById.mockResolvedValue(po);

    const { approvePurchaseOrder } = await import('@/lib/purchaseOrdersService.js');
    const user = {
      _id: 'u-om',
      name: 'OM User',
      permissions: ['po.approve.om'],
      roleName: 'Operation Manager',
    };

    await approvePurchaseOrder('poid1', user, { comment: 'ok', __v: 0 });

    expect(mocks.notifyWorkflowEmailSafe).toHaveBeenCalledTimes(1);
    expect(mocks.notifyWorkflowEmailSafe).toHaveBeenCalledWith(
      'po.om.approved',
      expect.objectContaining({
        status: PO_STATUS.PENDING_FINANCE,
        stepRecipientEmails: ['finance@example.com'],
        requiredPermission: 'po.approve.finance',
      }),
      { documentType: 'PO', documentId: 'poid1' },
    );
    expect(mocks.createSapPurchaseOrder).not.toHaveBeenCalled();
  });

  it('Finance approval keeps po.finance.approved and triggers SAP creation', async () => {
    const po = makePoDoc({
      status: PO_STATUS.PENDING_FINANCE,
      currentApprovalStep: 3,
    });
    mocks.findById
      .mockResolvedValueOnce(po)
      .mockReturnValueOnce({
        lean: vi.fn().mockResolvedValue({
          _id: { toString: () => 'poid1' },
          portalPONumber: 'PO-TEST-001',
          status: PO_STATUS.APPROVED,
          currentApprovalStep: 3,
        }),
      });

    const { approvePurchaseOrder } = await import('@/lib/purchaseOrdersService.js');
    const user = {
      _id: 'u-fin',
      name: 'Finance User',
      permissions: ['po.approve.finance'],
      roleName: 'Finance',
    };

    await approvePurchaseOrder('poid1', user, { comment: 'approved', __v: 0 });

    expect(mocks.notifyWorkflowEmailSafe).toHaveBeenCalledTimes(1);
    expect(mocks.notifyWorkflowEmailSafe).toHaveBeenCalledWith(
      'po.finance.approved',
      expect.objectContaining({
        portalPONumber: 'PO-TEST-001',
        status: 'Approved — SAP creation has started',
      }),
      { documentType: 'PO', documentId: 'poid1' },
    );
    expect(mocks.createSapPurchaseOrder).toHaveBeenCalledWith('poid1', user);
  });
});

describe('PO recipient priority', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sendEmail.mockResolvedValue({ success: true });
    mocks.roleFind.mockReturnValue(mockQueryChain([]));
    mocks.userFind.mockReturnValue(mockQueryChain([]));
  });

  it('prefers active EmailGroup over matrix step recipients for po.pm.approved', async () => {
    mocks.emailGroupFindOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        isActive: true,
        recipients: [{ email: 'custom@example.com' }],
        ccRoles: [],
      }),
    });

    const { resolveEventRecipients } = await import('@/lib/emailNotify.js');
    const result = await resolveEventRecipients('po.pm.approved', {
      stepRecipientEmails: ['om@example.com'],
      requiredPermission: 'po.approve.om',
    });

    expect(result.to).toEqual(['custom@example.com']);
    expect(result.to).not.toContain('om@example.com');
  });

  it('uses matrix step recipients when EmailGroup is missing', async () => {
    mocks.emailGroupFindOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
    });

    const { resolveEventRecipients } = await import('@/lib/emailNotify.js');
    const result = await resolveEventRecipients('po.pm.approved', {
      stepRecipientEmails: ['om@example.com'],
    });

    expect(result.to).toEqual(['om@example.com']);
  });

  it('falls back to Operation Manager role when no EmailGroup or step recipients', async () => {
    mocks.emailGroupFindOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
    });
    mocks.roleFind.mockReturnValue(
      mockQueryChain([{ _id: 'role-om', name: 'Operation Manager' }]),
    );
    mocks.userFind.mockReturnValue(mockQueryChain([{ email: 'om@example.com' }]));

    const { resolveEventRecipients } = await import('@/lib/emailNotify.js');
    const result = await resolveEventRecipients('po.pm.approved', {});

    expect(result.to).toEqual(['om@example.com']);
  });

  it('falls back to Finance role for po.om.approved when no EmailGroup or step recipients', async () => {
    mocks.emailGroupFindOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
    });
    mocks.roleFind.mockReturnValue(mockQueryChain([{ _id: 'role-fin', name: 'Finance' }]));
    mocks.userFind.mockReturnValue(mockQueryChain([{ email: 'finance@example.com' }]));

    const { resolveEventRecipients } = await import('@/lib/emailNotify.js');
    const result = await resolveEventRecipients('po.om.approved', {});

    expect(result.to).toEqual(['finance@example.com']);
  });

  it('uses static fallback for PR when EmailGroup is inactive and no step context', async () => {
    mocks.emailGroupFindOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        isActive: false,
        recipients: [{ email: 'ignored@example.com' }],
        ccRoles: [],
      }),
    });
    mocks.roleFind.mockReturnValue(
      mockQueryChain([{ _id: 'r1', name: 'WHS Approver' }]),
    );
    mocks.userFind.mockReturnValue(mockQueryChain([{ email: 'whs@example.com' }]));

    const { resolveEventRecipients } = await import('@/lib/emailNotify.js');
    const result = await resolveEventRecipients('pr.created', {});

    expect(result.to).toContain('whs@example.com');
    expect(result.to).not.toContain('ignored@example.com');
  });
});
