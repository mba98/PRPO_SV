import fs from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  emailGroupFindOne: vi.fn(),
  roleFind: vi.fn(),
  userFind: vi.fn(),
  userFindById: vi.fn(),
  sendEmail: vi.fn(),
  getApprovalHistory: vi.fn(),
}));

vi.mock('@/lib/mongodb', () => ({
  connectDB: vi.fn().mockResolvedValue(),
}));

vi.mock('@/models/index.js', () => ({}));

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

vi.mock('@/lib/auditHistory.js', () => ({
  getApprovalHistory: (...args) => mocks.getApprovalHistory(...args),
}));

import { buildWorkflowEmail } from '@/lib/emailTemplates.js';
import { buildLpEmailContext } from '@/lib/lpEmailContext.js';
import {
  dedupeEmailsCaseInsensitive,
  resolveActiveUserEmailsByPermission,
  resolveLpCompletionRecipientEmails,
} from '@/lib/lpEmailRecipients.js';

function mockQueryChain(rows = []) {
  const lean = vi.fn().mockResolvedValue(rows);
  const select = vi.fn().mockReturnValue({ lean, populate: vi.fn().mockReturnValue({ lean }) });
  const populate = vi.fn().mockReturnValue({ select, lean });
  return { select, populate, lean };
}

describe('lpEmailRecipients', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.roleFind.mockReturnValue(mockQueryChain([]));
    mocks.userFind.mockReturnValue(mockQueryChain([]));
  });

  it('deduplicates email addresses case-insensitively', () => {
    expect(
      dedupeEmailsCaseInsensitive(['A@Example.com', 'a@example.com', 'B@Example.com', '']),
    ).toEqual(['A@Example.com', 'B@Example.com']);
  });

  it('resolves active users by permission from roles and direct grants', async () => {
    mocks.roleFind.mockReturnValue(mockQueryChain([{ _id: 'role-pm' }]));
    mocks.userFind.mockReturnValue(
      mockQueryChain([
        {
          email: 'pm1@example.com',
          role: { _id: 'role-pm', permissions: ['lp.approve.pm'] },
          permissions: [],
        },
        {
          email: 'pm2@example.com',
          role: { _id: 'role-pm', permissions: ['lp.approve.pm'] },
          permissions: [],
        },
      ]),
    );

    const emails = await resolveActiveUserEmailsByPermission('lp.approve.pm');
    expect(emails).toEqual(['pm1@example.com', 'pm2@example.com']);
    expect(mocks.userFind).toHaveBeenCalledWith(
      expect.objectContaining({
        isActive: true,
        $or: expect.arrayContaining([
          { role: { $in: ['role-pm'] } },
          { permissions: 'lp.approve.pm' },
        ]),
      }),
    );
  });

  it('combines creator, history actors, and extras for completion recipients', async () => {
    mocks.getApprovalHistory.mockResolvedValue([
      { actionBy: { _id: 'u2', name: 'PM User' } },
      { actionBy: { _id: 'u3', name: 'Finance User' } },
    ]);
    mocks.userFind.mockReturnValue(
      mockQueryChain([{ email: 'pm@example.com' }, { email: 'finance@example.com' }]),
    );

    const emails = await resolveLpCompletionRecipientEmails('doc123', {
      creatorEmail: 'creator@example.com',
      extraTo: ['finance@example.com', 'GROUP@example.com'],
    });

    expect(emails).toEqual([
      'creator@example.com',
      'pm@example.com',
      'finance@example.com',
      'GROUP@example.com',
    ]);
  });
});

describe('lp email notify integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sendEmail.mockResolvedValue({ success: true });
    mocks.emailGroupFindOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
    });
    mocks.roleFind.mockReturnValue(mockQueryChain([]));
    mocks.userFind.mockReturnValue(mockQueryChain([]));
    mocks.getApprovalHistory.mockResolvedValue([]);
  });

  it('submit pending_pm resolves PM permission holders', async () => {
    mocks.roleFind.mockReturnValue(mockQueryChain([{ _id: 'role-pm' }]));
    mocks.userFind.mockReturnValue(
      mockQueryChain([
        {
          email: 'pm@example.com',
          role: { _id: 'role-pm', name: 'Project Manager', permissions: ['lp.approve.pm'] },
          permissions: [],
        },
      ]),
    );

    const { resolveEventRecipients } = await import('@/lib/emailNotify.js');
    const result = await resolveEventRecipients('local_purchase.pending_pm', {
      stepRecipientEmails: ['pm@example.com'],
    });

    expect(result.to).toContain('pm@example.com');
  });

  it('submit pending_pm still resolves PM users when optional email group is inactive', async () => {
    mocks.emailGroupFindOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
    });
    mocks.roleFind.mockReturnValue(mockQueryChain([{ _id: 'role-pm' }]));
    mocks.userFind.mockReturnValue(
      mockQueryChain([
        {
          email: 'pm@example.com',
          role: { _id: 'role-pm', name: 'Project Manager', permissions: ['lp.approve.pm'] },
          permissions: [],
        },
      ]),
    );

    const { resolveApprovalStepRecipientEmails } = await import('@/lib/lpEmailRecipients.js');
    const stepResult = await resolveApprovalStepRecipientEmails({
      stepOrder: 1,
      requiredPermission: 'lp.approve.pm',
      approverRole: { _id: 'role-pm', name: 'Project Manager' },
    });

    expect(stepResult.emails).toEqual(['pm@example.com']);
    expect(stepResult.eligibleUsers).toBe(1);
  });

  it('pending_finance resolves finance permission holders', async () => {
    mocks.roleFind.mockReturnValue(mockQueryChain([{ _id: 'role-fin' }]));
    mocks.userFind.mockReturnValue(mockQueryChain([{ email: 'finance@example.com' }]));

    const { resolveEventRecipients } = await import('@/lib/emailNotify.js');
    const result = await resolveEventRecipients('local_purchase.pending_finance', {
      requiredPermission: 'lp.approve.finance',
    });

    expect(result.to).toContain('finance@example.com');
  });

  it('pm_approved includes procurement creator via requesterEmail', async () => {
    const { resolveEventRecipients } = await import('@/lib/emailNotify.js');
    const result = await resolveEventRecipients('local_purchase.pm_approved', {
      requesterEmail: 'procurement@example.com',
    });

    expect(result.to).toContain('procurement@example.com');
  });

  it('completed merges email group, creator, and history actors without duplicates', async () => {
    mocks.emailGroupFindOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        isActive: true,
        recipients: [{ email: 'completion-group@example.com' }],
        ccRoles: [],
      }),
    });
    mocks.getApprovalHistory.mockResolvedValue([{ actionBy: { _id: 'u2' } }]);
    mocks.userFind.mockReturnValue(
      mockQueryChain([
        {
          email: 'pm@example.com',
          role: { _id: 'role-pm', name: 'Project Manager', permissions: ['lp.approve.pm'] },
          permissions: [],
        },
      ]),
    );

    const { resolveEventRecipients } = await import('@/lib/emailNotify.js');
    const result = await resolveEventRecipients('local_purchase.completed', {
      documentId: '507f1f77bcf86cd799439011',
      creatorEmail: 'creator@example.com',
      requesterEmail: 'creator@example.com',
    });

    expect(result.to).toEqual([
      'completion-group@example.com',
      'creator@example.com',
      'pm@example.com',
    ]);
  });

  it('logs failed delivery without throwing from notifyWorkflowEmail', async () => {
    mocks.sendEmail.mockResolvedValue({
      success: false,
      error: 'SMTP connection refused',
    });

    const { notifyWorkflowEmail } = await import('@/lib/emailNotify.js');
    const result = await notifyWorkflowEmail(
      'local_purchase.pending_pm',
      {
        portalLPNumber: 'LP-001',
        documentId: '507f1f77bcf86cd799439011',
        stepRecipientEmails: ['pm@example.com'],
      },
      { documentType: 'LOCAL_PURCHASE', documentId: '507f1f77bcf86cd799439011' },
    );

    expect(result.success).toBe(false);
    expect(result.attempted).toBe(true);
    expect(mocks.sendEmail).toHaveBeenCalled();
  });

  it('records NO_ELIGIBLE_EMAIL_RECIPIENTS when no recipients resolve', async () => {
    mocks.sendEmail.mockResolvedValue({ success: false, error: 'No recipients' });

    const { notifyWorkflowEmail } = await import('@/lib/emailNotify.js');
    const result = await notifyWorkflowEmail(
      'local_purchase.pending_pm',
      {
        portalLPNumber: 'LP-001',
        documentId: '507f1f77bcf86cd799439011',
      },
      { documentType: 'LOCAL_PURCHASE', documentId: '507f1f77bcf86cd799439011' },
    );

    expect(result.noRecipients).toBe(true);
    expect(result.errorCode).toBe('NO_ELIGIBLE_EMAIL_RECIPIENTS');
  });

  it('creates email log entry on successful delivery', async () => {
    mocks.roleFind.mockReturnValue(mockQueryChain([{ _id: 'role-pm' }]));
    mocks.userFind.mockReturnValue(
      mockQueryChain([
        {
          email: 'pm@example.com',
          role: { _id: 'role-pm', name: 'Project Manager', permissions: ['lp.approve.pm'] },
          permissions: [],
        },
      ]),
    );
    mocks.sendEmail.mockResolvedValue({ success: true, logId: 'log1' });

    const { notifyWorkflowEmail } = await import('@/lib/emailNotify.js');
    const result = await notifyWorkflowEmail(
      'local_purchase.pending_pm',
      {
        portalLPNumber: 'LP-001',
        documentId: '507f1f77bcf86cd799439011',
        stepRecipientEmails: ['pm@example.com'],
      },
      { documentType: 'LOCAL_PURCHASE', documentId: '507f1f77bcf86cd799439011' },
    );

    expect(result.success).toBe(true);
    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKey: 'local_purchase.pending_pm',
        to: ['pm@example.com'],
      }),
    );
  });

  it('concurrent losing approval sends no email when atomic transition fails', () => {
    const servicePath = new URL('../../lib/localPurchasesService.js', import.meta.url);
    const source = fs.readFileSync(servicePath, 'utf8');
    const approveBlock = source.slice(source.indexOf('export async function approveLocalPurchase'));
    expect(approveBlock).toContain('atomicDocumentStepTransition');
    expect(approveBlock.indexOf('atomicDocumentStepTransition')).toBeLessThan(
      approveBlock.indexOf('sendLocalPurchaseWorkflowEmail'),
    );
  });
});

describe('lp email templates', () => {
  const base = {
    portalLPNumber: 'LP-20260620-0003',
    documentId: '507f1f77bcf86cd799439011',
    requestDate: '2026-06-20',
    currency: 'IQD',
    budgetFormatted: 'IQD 1,000,000',
    documentTotalFormatted: 'IQD 250,000',
    lineCount: 3,
    remarks: 'Urgent local purchase',
    creatorName: 'Procurement User',
  };

  it('pending_pm subject matches spec and includes approval link', () => {
    const { subject, html, text } = buildWorkflowEmail('local_purchase.pending_pm', base);
    expect(subject).toBe('Local Purchase LP-20260620-0003 requires Project Manager approval');
    expect(html).toContain('LP-20260620-0003');
    expect(html).toContain('IQD 1,000,000');
    expect(html).toContain('/local-purchases/507f1f77bcf86cd799439011/approve');
    expect(text).toContain('Project Manager approval');
    expect(html).not.toMatch(/SAP/i);
    expect(text).not.toMatch(/SAP/i);
  });

  it('pending_finance states finance approval is required', () => {
    const { html } = buildWorkflowEmail('local_purchase.pending_finance', {
      ...base,
      pmApproverName: 'PM User',
      comment: 'Looks good',
    });
    expect(html).toContain('Finance approval');
    expect(html).toContain('PM User');
    expect(html).not.toMatch(/SAP/i);
  });

  it('pm_approved notifies procurement of PM approval', () => {
    const { subject, html } = buildWorkflowEmail('local_purchase.pm_approved', {
      ...base,
      pmApproverName: 'PM User',
    });
    expect(subject).toContain('approved by Project Manager');
    expect(html).toContain('Finance approval');
  });

  it('completed subject and body have no SAP wording', () => {
    const { subject, html, text } = buildWorkflowEmail('local_purchase.completed', {
      ...base,
      currency: 'USD',
      budgetFormatted: 'USD 1,000.00',
      documentTotalFormatted: 'USD 500.00',
      pmApproverName: 'PM User',
      financeApproverName: 'Finance User',
      completedAtFormatted: '20 Jun 2026, 14:30',
    });
    expect(subject).toBe('Local Purchase LP-20260620-0003 completed');
    expect(html).toContain('completed locally');
    expect(html).toContain('USD 1,000.00');
    expect(html).not.toMatch(/SAP/i);
    expect(text).not.toMatch(/SAP/i);
  });

  it('rejection template highlights rejection reason', () => {
    const { html } = buildWorkflowEmail('local_purchase.rejected', {
      ...base,
      rejectionReason: 'Budget exceeded',
      rejectingStep: 'Finance Approval',
      rejectingUserName: 'Finance User',
    });
    expect(html).toContain('Budget exceeded');
    expect(html).toContain('/edit');
    expect(html).toContain('تم رفض طلب المشتريات المحلية');
  });

  it('resubmitted template includes previous rejection reason', () => {
    const { html } = buildWorkflowEmail('local_purchase.resubmitted', {
      ...base,
      previousRejectionReason: 'Missing details',
    });
    expect(html).toContain('Missing details');
    expect(html).toContain('/approve');
  });

  it('formats IQD and USD via buildLpEmailContext', () => {
    const ctx = buildLpEmailContext({
      portalLPNumber: 'LP-1',
      documentDate: new Date('2026-06-20'),
      currency: 'IQD',
      budget: 1000000,
      documentTotal: 250000,
      lines: [{ quantity: 1, unitPrice: 250000, lineTotal: 250000 }],
      createdBy: { name: 'Creator', email: 'c@example.com' },
    });
    expect(ctx.budgetFormatted).toBe('IQD 1,000,000');
    expect(ctx.documentTotalFormatted).toBe('IQD 250,000');

    const usd = buildLpEmailContext({
      portalLPNumber: 'LP-2',
      currency: 'USD',
      budget: 1000,
      documentTotal: 500,
      lines: [{ quantity: 1, unitPrice: 500, lineTotal: 500 }],
    });
    expect(usd.budgetFormatted).toBe('USD 1,000.00');
    expect(usd.documentTotalFormatted).toBe('USD 500.00');
  });
});

describe('lp email service wiring', () => {
  it('localPurchasesService has no SAP integration imports or calls', () => {
    const servicePath = new URL('../../lib/localPurchasesService.js', import.meta.url);
    const notifyPath = new URL('../../lib/lpEmailNotify.js', import.meta.url);
    const serviceSource = fs.readFileSync(servicePath, 'utf8');
    const notifySource = fs.readFileSync(notifyPath, 'utf8');
    expect(serviceSource).not.toMatch(/from '@\/lib\/sap/i);
    expect(serviceSource).not.toMatch(/createSap|retrySap|toSap/i);
    expect(serviceSource).toMatch(/sendLocalPurchaseSubmitEmail/);
    expect(serviceSource).toMatch(/local_purchase\.pm_approved/);
    expect(serviceSource).toMatch(/local_purchase\.completed/);
    expect(notifySource).toMatch(/local_purchase\.pending_pm/);
    const approveBlock = serviceSource.slice(serviceSource.indexOf('export async function approveLocalPurchase'));
    const emailIdx = approveBlock.indexOf('sendLocalPurchaseWorkflowEmail');
    const atomicIdx = approveBlock.indexOf('atomicDocumentStepTransition');
    expect(atomicIdx).toBeGreaterThan(-1);
    expect(emailIdx).toBeGreaterThan(atomicIdx);
  });

  it('PR PO APRI email templates remain present', () => {
    const pr = buildWorkflowEmail('pr.created', {
      portalPRNumber: 'PR-1',
      documentId: 'abc',
    });
    expect(pr.subject).toContain('PR-1');

    const po = buildWorkflowEmail('po.created', {
      portalPONumber: 'PO-1',
      documentId: 'abc',
    });
    expect(po.subject).toContain('PO-1');

    const apri = buildWorkflowEmail('apri.warehouse.approved', {
      portalAPNumber: 'AP-1',
      documentId: 'abc',
    });
    expect(apri.subject).toContain('AP-1');
  });
});

describe('lp email detail tab', () => {
  it('LpDetailView loads email logs lazily for LOCAL_PURCHASE', () => {
    const viewPath = new URL('../../components/local-purchases/LpDetailView.jsx', import.meta.url);
    const source = fs.readFileSync(viewPath, 'utf8');
    expect(source).toContain("relatedDocumentType: 'LOCAL_PURCHASE'");
    expect(source).toContain("activeTab !== 'emails'");
    expect(source).toContain('eventKey');
  });
});
