import mongoose from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  assertCanAccess: vi.fn().mockResolvedValue({ _id: 'doc1' }),
  attachmentFind: vi.fn(),
  commentCreate: vi.fn(),
  commentFindById: vi.fn(),
  commentFind: vi.fn(),
  logHistory: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/mongodb', () => ({ connectDB: vi.fn().mockResolvedValue(true) }));

vi.mock('@/lib/documentAccess.js', () => ({
  assertCanAccessDocument: mocks.assertCanAccess,
}));

vi.mock('@/models/Attachment.js', () => ({
  default: { find: (...args) => mocks.attachmentFind(...args) },
}));

vi.mock('@/models/Comment.js', () => ({
  default: {
    create: (...args) => mocks.commentCreate(...args),
    findById: (...args) => mocks.commentFindById(...args),
    find: (...args) => mocks.commentFind(...args),
  },
}));

vi.mock('@/lib/auditHistory.js', () => ({
  logApprovalHistory: mocks.logHistory,
  getApprovalHistory: vi.fn().mockResolvedValue([]),
}));

import { addComment, listComments } from '@/lib/commentsService';

const PR_ID = '64b8c1a52f5b1b2c3d4e5f60';
const ATT_ID = '64b8c1a52f5b1b2c3d4e5f70';
const USER = { _id: 'user1', id: 'user1', roleName: 'Requester' };

function selectLean(rows) {
  return { select: () => ({ lean: () => Promise.resolve(rows) }) };
}

function populatedLean(rows) {
  return {
    sort: () => ({
      populate: () => ({
        populate: () => ({ lean: () => Promise.resolve(rows) }),
      }),
    }),
  };
}

function populatedLeanSingle(row) {
  return {
    populate: () => ({
      populate: () => ({ lean: () => Promise.resolve(row) }),
    }),
  };
}

describe('commentsService.addComment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertCanAccess.mockResolvedValue({ _id: 'doc1' });
    mocks.commentCreate.mockImplementation(async (doc) => ({
      _id: { toString: () => 'comment1' },
      ...doc,
    }));
    mocks.commentFindById.mockReturnValue(
      populatedLeanSingle({
        _id: { toString: () => 'comment1' },
        documentType: 'PR',
        documentId: { toString: () => PR_ID },
        comment: 'Looks good',
        postedBy: { name: 'Alice' },
        postedAt: new Date('2026-05-23T10:00:00Z'),
        attachments: [],
      }),
    );
  });

  it('persists the comment, logs Comment Added, and returns sanitized row', async () => {
    const result = await addComment(USER, {
      documentType: 'PR',
      documentId: PR_ID,
      comment: 'Looks good',
    });

    expect(mocks.assertCanAccess).toHaveBeenCalledWith(USER, 'PR', PR_ID);
    expect(mocks.commentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        documentType: 'PR',
        documentId: new mongoose.Types.ObjectId(PR_ID),
        comment: 'Looks good',
        postedBy: 'user1',
      }),
    );
    expect(mocks.logHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        documentType: 'PR',
        documentId: new mongoose.Types.ObjectId(PR_ID),
        action: 'Comment Added',
        comment: 'Looks good',
        actionBy: USER,
      }),
    );
    expect(result).toMatchObject({
      id: 'comment1',
      postedBy: 'Alice',
      comment: 'Looks good',
    });
  });

  it('accepts valid attachment ids that belong to the same document', async () => {
    mocks.attachmentFind.mockReturnValueOnce(selectLean([{ _id: ATT_ID }]));
    await addComment(USER, {
      documentType: 'PR',
      documentId: PR_ID,
      comment: 'See attached',
      attachments: [ATT_ID],
    });
    expect(mocks.attachmentFind).toHaveBeenCalledWith({
      _id: { $in: [ATT_ID] },
      documentType: 'PR',
      documentId: new mongoose.Types.ObjectId(PR_ID),
    });
    expect(mocks.commentCreate).toHaveBeenCalledWith(
      expect.objectContaining({ attachments: [ATT_ID] }),
    );
  });

  it('rejects attachments that belong to a different document with INVALID_ATTACHMENT_SCOPE', async () => {
    mocks.attachmentFind.mockReturnValueOnce(selectLean([]));
    await expect(
      addComment(USER, {
        documentType: 'PR',
        documentId: PR_ID,
        comment: 'Sneaky',
        attachments: [ATT_ID],
      }),
    ).rejects.toMatchObject({ code: 'INVALID_ATTACHMENT_SCOPE' });

    expect(mocks.commentCreate).not.toHaveBeenCalled();
    expect(mocks.logHistory).not.toHaveBeenCalled();
  });

  it('propagates FORBIDDEN when the user cannot access the document', async () => {
    const err = new Error('Forbidden');
    err.code = 'FORBIDDEN';
    mocks.assertCanAccess.mockRejectedValueOnce(err);
    await expect(
      addComment(USER, {
        documentType: 'PR',
        documentId: PR_ID,
        comment: 'Hi',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(mocks.commentCreate).not.toHaveBeenCalled();
    expect(mocks.logHistory).not.toHaveBeenCalled();
  });
});

describe('commentsService.listComments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertCanAccess.mockResolvedValue({ _id: 'doc1' });
  });

  it('enforces access and returns sanitized rows', async () => {
    mocks.commentFind.mockReturnValueOnce(
      populatedLean([
        {
          _id: { toString: () => 'c1' },
          documentType: 'PR',
          documentId: { toString: () => PR_ID },
          comment: 'first',
          postedBy: { username: 'bob' },
          postedAt: new Date('2026-05-22'),
          attachments: [],
        },
      ]),
    );
    const result = await listComments(USER, 'PR', PR_ID);
    expect(mocks.assertCanAccess).toHaveBeenCalledWith(USER, 'PR', PR_ID);
    expect(result).toEqual([
      expect.objectContaining({ id: 'c1', postedBy: 'bob', comment: 'first' }),
    ]);
  });

  it('returns FORBIDDEN when the user cannot access the document', async () => {
    const err = new Error('Forbidden');
    err.code = 'FORBIDDEN';
    mocks.assertCanAccess.mockRejectedValueOnce(err);
    await expect(listComments(USER, 'PR', PR_ID)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});
