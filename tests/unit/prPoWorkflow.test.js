import { describe, expect, it, vi, beforeEach } from 'vitest';
import { dedupeEmailsCaseInsensitive } from '@/lib/lpEmailRecipients.js';
import { resolveWorkflowSapFailureRecipients } from '@/lib/workflowEmailRecipients.js';
import { resolveEventRecipients } from '@/lib/emailNotify.js';
import { buildWorkflowEmail } from '@/lib/emailTemplates.js';
import { sanitizeSapErrorForEmail } from '@/lib/sapErrorSanitize.js';
import {
  canUserRetrySapDocument,
  getFinalApprovalStep,
  isDocumentEligibleForSapRetry,
  userCanActAsFinalStepApprover,
  userPerformedFinalApproval,
} from '@/lib/sapRetryAuth.js';
import { canEditPurchaseOrder } from '@/lib/poEditPermissions.js';
import { PO_STATUS } from '@/lib/poStatus.js';

vi.mock('@/lib/mongodb', () => ({ connectDB: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/models/index.js', () => ({}));

vi.mock('@/models/User.js', () => ({
  default: {
    find: vi.fn(),
    findById: vi.fn(),
  },
}));

vi.mock('@/models/Role.js', () => ({
  default: {
    find: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([]),
      }),
      lean: vi.fn().mockResolvedValue([]),
    }),
  },
}));

vi.mock('@/models/EmailGroup.js', () => ({
  default: {
    findOne: vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
    }),
  },
}));

vi.mock('@/lib/auditHistory.js', () => ({
  getApprovalHistory: vi.fn(),
}));

vi.mock('@/lib/approvalEngine.js', () => ({
  getApprovalSteps: vi.fn(),
}));

import User from '@/models/User.js';
import { getApprovalHistory } from '@/lib/auditHistory.js';
import { getApprovalSteps } from '@/lib/approvalEngine.js';

const PO_STEPS = [
  { stepOrder: 1, stepName: 'PM Approval', requiredPermission: 'po.approve.pm', isActive: true },
  { stepOrder: 2, stepName: 'OM Approval', requiredPermission: 'po.approve.om', isActive: true },
  {
    stepOrder: 3,
    stepName: 'Finance Approval',
    requiredPermission: 'po.approve.finance',
    approverRole: { _id: 'role-finance', name: 'Finance' },
    isActive: true,
  },
];

const PR_STEPS = [
  {
    stepOrder: 1,
    stepName: 'Warehouse Approval',
    requiredPermission: 'pr.approve.whs',
    isActive: true,
  },
  {
    stepOrder: 2,
    stepName: 'PM Approval',
    requiredPermission: 'pr.approve.pm',
    approverRole: { _id: 'role-pm', name: 'Project Manager' },
    isActive: true,
  },
];

describe('SAP failure email recipients', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getApprovalSteps.mockResolvedValue(PO_STEPS);
    getApprovalHistory.mockResolvedValue([
      {
        action: 'Approved',
        stepOrder: 1,
        actionBy: { _id: 'user-pm', email: 'pm@example.com' },
      },
      {
        action: 'Approved',
        stepOrder: 3,
        actionBy: { _id: 'user-fin', email: 'finance@example.com' },
      },
    ]);
    User.find.mockImplementation((query) => {
      const chain = {
        populate: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue([]),
      };
      if (query.role) {
        chain.lean.mockResolvedValue([
          {
            email: 'finance@example.com',
            role: { permissions: ['po.approve.finance'] },
            permissions: [],
          },
        ]);
      } else if (query._id?.$in) {
        chain.lean.mockResolvedValue([
          { email: 'pm@example.com' },
          { email: 'finance@example.com' },
        ]);
      } else if (query.permissions || query.$or) {
        chain.lean.mockResolvedValue([
          {
            email: 'procurement@example.com',
            role: { permissions: ['po.create'] },
            permissions: [],
          },
        ]);
      }
      return chain;
    });
    User.findById = vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
    });
  });

  it('resolves involved PO SAP failure recipients', async () => {
    const emails = await resolveWorkflowSapFailureRecipients({
      documentType: 'PO',
      documentId: 'doc1',
      context: {
        requesterEmail: 'requester@example.com',
        creatorEmail: 'procurement@example.com',
      },
    });
    expect(emails).toContain('requester@example.com');
    expect(emails).toContain('pm@example.com');
    expect(emails).toContain('finance@example.com');
  });

  it('deduplicates recipient emails case-insensitively', async () => {
    const emails = dedupeEmailsCaseInsensitive([
      'Finance@Example.com',
      'finance@example.com',
      'PM@example.com',
    ]);
    expect(emails).toHaveLength(2);
  });

  it('includes involved users in resolveEventRecipients for po.sap.failed', async () => {
    const { to } = await resolveEventRecipients('po.sap.failed', {
      documentId: 'doc1',
      requesterEmail: 'requester@example.com',
    });
    expect(to).toContain('requester@example.com');
    expect(to).toContain('pm@example.com');
  });
});

describe('SAP failure email templates', () => {
  it('includes sanitized SAP error and retry note in po.sap.failed', () => {
    const { html, text } = buildWorkflowEmail('po.sap.failed', {
      portalPONumber: 'PO-1',
      documentId: 'id1',
      status: 'Failed to Create in SAP',
      sapErrorMessage: 'Vendor code invalid',
    });
    expect(html).toContain('Vendor code invalid');
    expect(html).toContain('final-step approver');
    expect(text).toContain('Vendor code invalid');
  });

  it('does not treat finance-approved email as SAP success', () => {
    const { html, text } = buildWorkflowEmail('po.finance.approved', {
      portalPONumber: 'PO-1',
      documentId: 'id1',
      status: 'Approved — SAP creation has started',
    });
    expect(html).toContain('SAP creation has started');
    expect(html).not.toContain('will be created in SAP');
    expect(text).not.toContain('successfully created in SAP');
  });

  it('sanitizes credentials from SAP errors', () => {
    const sanitized = sanitizeSapErrorForEmail('Failed B1SESSION=abc123 RouteId=xyz');
    expect(sanitized).not.toContain('abc123');
    expect(sanitized).toContain('[redacted]');
  });
});

describe('PO edit permissions', () => {
  const procurement = { permissions: [], role: { permissions: ['po.create'] } };
  const basePo = { sapPODocEntry: null };

  it('allows procurement to edit before first approval', () => {
    expect(
      canEditPurchaseOrder(procurement, { ...basePo, status: PO_STATUS.PENDING_PM }, []),
    ).toBe(true);
  });

  it('blocks procurement after an approval step completes', () => {
    expect(
      canEditPurchaseOrder(
        procurement,
        { ...basePo, status: PO_STATUS.PENDING_OM },
        [{ action: 'Approved', stepName: 'PM' }],
      ),
    ).toBe(false);
  });

  it('allows procurement to edit after rejection', () => {
    expect(
      canEditPurchaseOrder(
        procurement,
        { ...basePo, status: PO_STATUS.REJECTED },
        [{ action: 'Approved' }, { action: 'Rejected' }],
      ),
    ).toBe(true);
  });

  it('blocks editing when SAP PO exists', () => {
    expect(
      canEditPurchaseOrder(
        procurement,
        { ...basePo, status: PO_STATUS.REJECTED, sapPODocEntry: 100 },
        [],
      ),
    ).toBe(false);
  });
});

describe('SAP retry authorization', () => {
  const financeUser = {
    _id: 'user-fin',
    permissions: [],
    role: { _id: 'role-finance', name: 'Finance', permissions: ['po.approve.finance'] },
  };
  const pmUser = {
    _id: 'user-pm',
    permissions: [],
    role: { _id: 'role-pm', name: 'Project Manager', permissions: ['po.approve.pm'] },
  };
  const admin = { _id: 'admin', permissions: ['admin.settings'] };

  it('identifies final matrix step dynamically', () => {
    expect(getFinalApprovalStep(PO_STEPS)?.requiredPermission).toBe('po.approve.finance');
  });

  it('allows final-step approver to retry failed SAP PO', () => {
    expect(
      canUserRetrySapDocument({
        user: financeUser,
        documentType: 'PO',
        document: { status: PO_STATUS.FAILED_SAP, sapPODocEntry: null },
        approvalSteps: PO_STEPS,
        approvalHistory: [],
      }),
    ).toBe(true);
  });

  it('denies non-final approver for SAP retry', () => {
    expect(
      canUserRetrySapDocument({
        user: pmUser,
        documentType: 'PO',
        document: { status: PO_STATUS.FAILED_SAP, sapPODocEntry: null },
        approvalSteps: PO_STEPS,
        approvalHistory: [],
      }),
    ).toBe(false);
  });

  it('allows admin.settings to retry via override', () => {
    expect(
      canUserRetrySapDocument({
        user: admin,
        documentType: 'PO',
        document: { status: PO_STATUS.FAILED_SAP, sapPODocEntry: null },
        approvalSteps: PO_STEPS,
        approvalHistory: [],
      }),
    ).toBe(true);
  });

  it('allows user who performed final approval to retry', () => {
    expect(
      userPerformedFinalApproval(
        'user-fin',
        [
          {
            action: 'Approved',
            stepOrder: 3,
            stepName: 'Finance Approval',
            actionBy: { _id: 'user-fin' },
          },
        ],
        getFinalApprovalStep(PO_STEPS),
      ),
    ).toBe(true);
  });

  it('blocks retry when SAP DocEntry already exists', () => {
    expect(
      isDocumentEligibleForSapRetry(
        { status: PO_STATUS.FAILED_SAP, sapPODocEntry: 42 },
        'PO',
      ),
    ).toBe(false);
  });

  it('blocks retry while SAP creation is in progress', () => {
    expect(
      isDocumentEligibleForSapRetry(
        { status: PO_STATUS.CREATING_IN_SAP, sapPODocEntry: null },
        'PO',
      ),
    ).toBe(false);
  });

  it('allows PR final-step approver based on matrix', () => {
    const pmPrUser = {
      _id: 'user-pm',
      permissions: [],
      role: { _id: 'role-pm', name: 'Project Manager', permissions: ['pr.approve.pm'] },
    };
    expect(
      userCanActAsFinalStepApprover(pmPrUser, getFinalApprovalStep(PR_STEPS), 'PR'),
    ).toBe(true);
    expect(
      canUserRetrySapDocument({
        user: pmPrUser,
        documentType: 'PR',
        document: { status: 'Failed to Create in SAP', sapPRDocEntry: null },
        approvalSteps: PR_STEPS,
        approvalHistory: [],
      }),
    ).toBe(true);
  });
});

describe('resubmission workflow expectations', () => {
  it('resubmit history uses Resubmitted action', async () => {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const { dirname, join } = await import('node:path');
    const dir = dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(join(dir, '../../lib/purchaseOrdersService.js'), 'utf8');
    expect(source).toContain("action: 'Resubmitted'");
    expect(source).toContain("'po.created'");
  });

  it('PoDetailView exposes resubmit and retry buttons from API flags', async () => {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const { dirname, join } = await import('node:path');
    const dir = dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(
      join(dir, '../../components/purchase-orders/PoDetailView.jsx'),
      'utf8',
    );
    expect(source).toContain('po.canResubmit');
    expect(source).toContain('po.canRetrySap');
    expect(source).toContain('showEditLockedMessage');
  });
});
