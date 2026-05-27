import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = {
  emailGroupFindOne: vi.fn(),
  roleFind: vi.fn(),
  userFind: vi.fn(),
  userFindById: vi.fn(),
  sendEmail: vi.fn(),
};

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

describe('emailNotify', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sendEmail.mockResolvedValue({ success: true });
    mocks.roleFind.mockReturnValue({
      lean: vi.fn().mockResolvedValue([]),
    });
    mocks.userFind.mockReturnValue({
      lean: vi.fn().mockResolvedValue([]),
    });
  });

  it('uses EmailGroup direct email when active', async () => {
    mocks.emailGroupFindOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        isActive: true,
        recipients: [{ email: 'override@example.com' }],
        ccRoles: [],
      }),
    });

    const { resolveEventRecipients } = await import('@/lib/emailNotify.js');
    const result = await resolveEventRecipients('pr.created', {});

    expect(result.to).toEqual(['override@example.com']);
  });

  it('uses role recipients from active EmailGroup', async () => {
    const roleId = '507f1f77bcf86cd799439011';
    mocks.emailGroupFindOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        isActive: true,
        recipients: [{ role: roleId }],
        ccRoles: [],
      }),
    });
    mocks.userFind.mockReturnValue({
      lean: vi.fn().mockResolvedValue([{ email: 'role-user@example.com' }]),
    });

    const { resolveEventRecipients } = await import('@/lib/emailNotify.js');
    const result = await resolveEventRecipients('pr.created', {});

    expect(result.to).toEqual(['role-user@example.com']);
  });

  it('falls back to role names when EmailGroup inactive', async () => {
    mocks.emailGroupFindOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        isActive: false,
        recipients: [{ email: 'ignored@example.com' }],
        ccRoles: [],
      }),
    });
    mocks.roleFind.mockReturnValue({
      lean: vi.fn().mockResolvedValue([{ _id: 'r1', name: 'WHS Approver' }]),
    });
    mocks.userFind.mockReturnValue({
      lean: vi.fn().mockResolvedValue([{ email: 'whs@example.com' }]),
    });

    const { resolveEventRecipients } = await import('@/lib/emailNotify.js');
    const result = await resolveEventRecipients('pr.created', {});

    expect(result.to).toContain('whs@example.com');
    expect(result.to).not.toContain('ignored@example.com');
  });

  it('writes failed EmailLog via sendEmail when no recipients', async () => {
    mocks.emailGroupFindOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
    });
    mocks.roleFind.mockReturnValue({ lean: vi.fn().mockResolvedValue([]) });
    mocks.sendEmail.mockResolvedValue({
      success: false,
      error: 'No recipients resolved for event pr.created',
    });

    const { notifyWorkflowEmail } = await import('@/lib/emailNotify.js');
    const result = await notifyWorkflowEmail(
      'pr.created',
      { portalPRNumber: 'PR-001', documentId: '507f1f77bcf86cd799439099' },
      { documentType: 'PR', documentId: '507f1f77bcf86cd799439099' },
    );

    expect(result.success).toBe(false);
    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: [],
        eventKey: 'pr.created',
      }),
    );
  });

  it('notifyWorkflowEmail does not throw for unknown event keys', async () => {
    mocks.emailGroupFindOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
    });
    mocks.roleFind.mockReturnValue({ lean: vi.fn().mockResolvedValue([]) });
    mocks.sendEmail.mockResolvedValue({ success: true });

    const { notifyWorkflowEmail } = await import('@/lib/emailNotify.js');
    await expect(notifyWorkflowEmail('unknown.event', {}, {})).resolves.toBeDefined();
  });
});
