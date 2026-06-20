import fs from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = {
  emailLogCount: vi.fn(),
  emailLogFind: vi.fn(),
  assertCanAccessDocument: vi.fn(),
  canViewEmailLogs: vi.fn(),
};

vi.mock('@/lib/mongodb', () => ({
  connectDB: vi.fn().mockResolvedValue(),
}));

vi.mock('@/models/index.js', () => ({}));

vi.mock('@/models/EmailLog.js', () => ({
  default: {
    countDocuments: mocks.emailLogCount,
    find: mocks.emailLogFind,
  },
}));

vi.mock('@/lib/documentAccess.js', () => ({
  assertCanAccessDocument: (...args) => mocks.assertCanAccessDocument(...args),
}));

vi.mock('@/lib/visibilityFilters.js', () => ({
  canViewEmailLogs: (...args) => mocks.canViewEmailLogs(...args),
}));

function mockEmailQuery(rows = []) {
  return {
    sort: vi.fn().mockReturnValue({
      skip: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue(rows),
        }),
      }),
    }),
  };
}

describe('emailLogsService document access', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.emailLogCount.mockResolvedValue(0);
    mocks.emailLogFind.mockReturnValue(mockEmailQuery([]));
    mocks.assertCanAccessDocument.mockResolvedValue({ _id: 'doc1' });
    mocks.canViewEmailLogs.mockReturnValue(false);
  });

  it('allows Local Purchase creator to list document-scoped email logs', async () => {
    const { listEmailLogs } = await import('@/lib/emailLogsService.js');
    const creator = { _id: 'u1', permissions: ['lp.create'] };

    await listEmailLogs(creator, {
      relatedDocumentType: 'LOCAL_PURCHASE',
      relatedDocumentId: '507f1f77bcf86cd799439011',
    });

    expect(mocks.assertCanAccessDocument).toHaveBeenCalledWith(
      creator,
      'LOCAL_PURCHASE',
      '507f1f77bcf86cd799439011',
    );
    expect(mocks.canViewEmailLogs).not.toHaveBeenCalled();
  });

  it('allows PM approver through document access check', async () => {
    const { listEmailLogs } = await import('@/lib/emailLogsService.js');
    const pmUser = { _id: 'u2', permissions: ['lp.approve.pm'] };

    await listEmailLogs(pmUser, {
      relatedDocumentType: 'LOCAL_PURCHASE',
      relatedDocumentId: '507f1f77bcf86cd799439011',
    });

    expect(mocks.assertCanAccessDocument).toHaveBeenCalled();
  });

  it('denies unrelated users for document-scoped logs', async () => {
    mocks.assertCanAccessDocument.mockRejectedValue(
      Object.assign(new Error('Forbidden'), { code: 'FORBIDDEN' }),
    );
    const { listEmailLogs } = await import('@/lib/emailLogsService.js');

    await expect(
      listEmailLogs({ _id: 'u9', permissions: [] }, {
        relatedDocumentType: 'LOCAL_PURCHASE',
        relatedDocumentId: '507f1f77bcf86cd799439011',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('requires admin permission for global email log listing', async () => {
    const { listEmailLogs } = await import('@/lib/emailLogsService.js');

    await expect(listEmailLogs({ _id: 'u1', permissions: ['lp.create'] }, {})).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(mocks.canViewEmailLogs).toHaveBeenCalled();
    expect(mocks.assertCanAccessDocument).not.toHaveBeenCalled();
  });

  it('allows admin global listing without document scope', async () => {
    mocks.canViewEmailLogs.mockReturnValue(true);
    const { listEmailLogs } = await import('@/lib/emailLogsService.js');

    await listEmailLogs({ _id: 'admin', permissions: ['admin.settings'] }, { page: 1, limit: 10 });
    expect(mocks.assertCanAccessDocument).not.toHaveBeenCalled();
  });
});

describe('LpDetailView email tab fetch guard', () => {
  it('uses a ref guard to avoid repeated fetches after 403', () => {
    const viewPath = new URL('../../components/local-purchases/LpDetailView.jsx', import.meta.url);
    const source = fs.readFileSync(viewPath, 'utf8');
    expect(source).toContain('emailFetchStateRef');
    expect(source).toContain("emailFetchStateRef.current !== 'idle'");
    expect(source).toContain('emailLogsForbidden');
    expect(source).toContain('finally');
    expect(source).not.toContain('emailLogs.length || emailLogsLoading');
  });
});
