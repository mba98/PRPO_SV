import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  assertCanAccess: vi.fn().mockResolvedValue({ _id: 'doc1' }),
  historyFind: vi.fn(),
}));

vi.mock('@/lib/mongodb', () => ({ connectDB: vi.fn().mockResolvedValue(true) }));

vi.mock('@/lib/documentAccess.js', () => ({
  assertCanAccessDocument: mocks.assertCanAccess,
}));

vi.mock('@/models/ApprovalHistory.js', () => ({
  default: { find: (...args) => mocks.historyFind(...args) },
}));

import { listApprovalHistory } from '@/lib/approvalHistoryService';

const PR_ID = '64b8c1a52f5b1b2c3d4e5f60';
const USER = { _id: 'user1' };

function chained(rows, sortSpy) {
  return {
    sort: (spec) => {
      sortSpy?.(spec);
      return {
        populate: () => ({
          populate: () => ({ lean: () => Promise.resolve(rows) }),
        }),
      };
    },
  };
}

describe('approvalHistoryService.listApprovalHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertCanAccess.mockResolvedValue({ _id: 'doc1' });
  });

  it('enforces document access', async () => {
    const err = new Error('Forbidden');
    err.code = 'FORBIDDEN';
    mocks.assertCanAccess.mockRejectedValueOnce(err);
    await expect(listApprovalHistory(USER, 'PR', PR_ID)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(mocks.historyFind).not.toHaveBeenCalled();
  });

  it('returns sanitized rows sorted ascending by actionDate', async () => {
    const sortSpy = vi.fn();
    mocks.historyFind.mockReturnValueOnce(
      chained(
        [
          {
            _id: { toString: () => 'h1' },
            documentType: 'PR',
            documentId: { toString: () => PR_ID },
            stepName: 'Creation',
            action: 'Created',
            actionBy: { name: 'Alice' },
            actionByRole: 'Requester',
            comment: null,
            attachments: [],
            actionDate: new Date('2026-05-20'),
            previousStatus: null,
            newStatus: 'Pending Warehouse Approval',
          },
          {
            _id: { toString: () => 'h2' },
            documentType: 'PR',
            documentId: { toString: () => PR_ID },
            stepName: 'Comment',
            action: 'Comment Added',
            actionBy: { username: 'bob' },
            actionByRole: 'Manager',
            comment: 'OK to proceed',
            attachments: [],
            actionDate: new Date('2026-05-21'),
            previousStatus: 'Pending Warehouse Approval',
            newStatus: 'Pending Warehouse Approval',
          },
        ],
        sortSpy,
      ),
    );

    const result = await listApprovalHistory(USER, 'PR', PR_ID);

    expect(mocks.assertCanAccess).toHaveBeenCalledWith(USER, 'PR', PR_ID);
    expect(sortSpy).toHaveBeenCalledWith({ actionDate: 1 });
    expect(result).toEqual([
      expect.objectContaining({
        id: 'h1',
        action: 'Created',
        actionBy: 'Alice',
        actionByRole: 'Requester',
      }),
      expect.objectContaining({
        id: 'h2',
        action: 'Comment Added',
        actionBy: 'bob',
        comment: 'OK to proceed',
      }),
    ]);
  });
});
