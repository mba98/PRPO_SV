import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  presignPut: vi.fn().mockResolvedValue('https://s3.example.com/put-url'),
  presignGet: vi.fn().mockResolvedValue('https://s3.example.com/get-url'),
  create: vi.fn(),
  find: vi.fn(),
  logHistory: vi.fn().mockResolvedValue({}),
  assertCanAccess: vi.fn().mockResolvedValue({ _id: 'doc1' }),
}));

vi.mock('@/lib/mongodb', () => ({ connectDB: vi.fn().mockResolvedValue(true) }));

vi.mock('@/lib/s3.js', () => ({
  buildS3Key: (type, id, ulid, name) => `${type}/${id}/${ulid}-${name}`,
  getPresignedPutUrl: mocks.presignPut,
  getPresignedGetUrl: mocks.presignGet,
  getMaxFileSizeBytes: () => 25 * 1024 * 1024,
}));

vi.mock('@/models/Attachment.js', () => ({
  default: {
    create: (...args) => mocks.create(...args),
    find: (...args) => mocks.find(...args),
  },
}));

vi.mock('@/lib/documentAccess.js', () => ({
  assertCanAccessDocument: mocks.assertCanAccess,
}));

vi.mock('@/lib/auditHistory.js', () => ({
  logApprovalHistory: mocks.logHistory,
  getApprovalHistory: vi.fn().mockResolvedValue([]),
}));

import {
  signUpload,
  completeUpload,
  listAttachments,
  safeFileName,
  newUlid,
  isAllowedMime,
  ALLOWED_MIME_TYPES,
} from '@/lib/attachmentsService.js';

const PR_ID = '64b8c1a52f5b1b2c3d4e5f60';
const USER = { _id: 'user1', id: 'user1', roleName: 'Requester' };

describe('attachmentsService helpers', () => {
  describe('safeFileName', () => {
    it('strips path separators and reserved characters', () => {
      expect(safeFileName('../../etc/passwd')).toBe('passwd');
      expect(safeFileName('My Invoice (2026).pdf')).toBe('My_Invoice_2026_.pdf');
      expect(safeFileName('  weird   name.csv  ')).toBe('weird_name.csv');
    });

    it('falls back to "file" for empty or punctuation-only input', () => {
      expect(safeFileName('')).toBe('file');
      expect(safeFileName(null)).toBe('file');
      expect(safeFileName('....')).toBe('file');
      expect(safeFileName('___')).toBe('file');
    });

    it('caps length at 200 chars', () => {
      const long = 'a'.repeat(300) + '.pdf';
      expect(safeFileName(long).length).toBeLessThanOrEqual(200);
    });
  });

  describe('newUlid', () => {
    it('returns a 26-char Crockford-base32 string', () => {
      const id = newUlid();
      expect(id).toHaveLength(26);
      expect(id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    });

    it('produces lexicographically increasing values for increasing timestamps', () => {
      const a = newUlid(1700000000000);
      const b = newUlid(1700000000001);
      expect(b.slice(0, 10) >= a.slice(0, 10)).toBe(true);
    });
  });

  describe('isAllowedMime / ALLOWED_MIME_TYPES', () => {
    it('exports the documented allow-list', () => {
      expect(ALLOWED_MIME_TYPES).toEqual([
        'application/pdf',
        'image/png',
        'image/jpeg',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'text/csv',
      ]);
    });

    it('accepts allowed and rejects disallowed', () => {
      expect(isAllowedMime('application/pdf')).toBe(true);
      expect(isAllowedMime('image/gif')).toBe(false);
      expect(isAllowedMime('application/zip')).toBe(false);
    });
  });
});

describe('signUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertCanAccess.mockResolvedValue({ _id: 'doc1' });
    mocks.presignPut.mockResolvedValue('https://s3.example.com/put-url');
  });

  it('returns pre-signed URL and a scoped s3Key', async () => {
    const result = await signUpload(USER, {
      documentType: 'PR',
      documentId: PR_ID,
      fileName: 'Quote A.pdf',
      fileType: 'application/pdf',
      fileSize: 1024,
    });
    expect(result.uploadUrl).toBe('https://s3.example.com/put-url');
    expect(result.s3Key.startsWith(`PR/${PR_ID}/`)).toBe(true);
    expect(result.safeFileName).toBe('Quote_A.pdf');
    expect(mocks.assertCanAccess).toHaveBeenCalledWith(USER, 'PR', PR_ID);
    expect(mocks.presignPut).toHaveBeenCalledWith(result.s3Key, 'application/pdf');
  });

  it('rejects disallowed MIME types', async () => {
    await expect(
      signUpload(USER, {
        documentType: 'PR',
        documentId: PR_ID,
        fileName: 'malware.exe',
        fileType: 'application/x-msdownload',
        fileSize: 1024,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_FILE_TYPE' });
    expect(mocks.presignPut).not.toHaveBeenCalled();
  });

  it('rejects files larger than 25 MB', async () => {
    await expect(
      signUpload(USER, {
        documentType: 'PR',
        documentId: PR_ID,
        fileName: 'big.pdf',
        fileType: 'application/pdf',
        fileSize: 26 * 1024 * 1024,
      }),
    ).rejects.toMatchObject({ code: 'FILE_TOO_LARGE' });
  });

  it('propagates FORBIDDEN when the user cannot access the document', async () => {
    const err = new Error('Forbidden');
    err.code = 'FORBIDDEN';
    mocks.assertCanAccess.mockRejectedValueOnce(err);
    await expect(
      signUpload(USER, {
        documentType: 'PR',
        documentId: PR_ID,
        fileName: 'doc.pdf',
        fileType: 'application/pdf',
        fileSize: 1024,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(mocks.presignPut).not.toHaveBeenCalled();
  });

  it('propagates NOT_FOUND when the document does not exist', async () => {
    const err = new Error('Not found');
    err.code = 'NOT_FOUND';
    mocks.assertCanAccess.mockRejectedValueOnce(err);
    await expect(
      signUpload(USER, {
        documentType: 'PR',
        documentId: PR_ID,
        fileName: 'doc.pdf',
        fileType: 'application/pdf',
        fileSize: 1024,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('completeUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertCanAccess.mockResolvedValue({ _id: 'doc1' });
    mocks.create.mockImplementation(async (doc) => ({
      _id: { toString: () => 'attach1' },
      documentId: { toString: () => doc.documentId },
      ...doc,
    }));
    mocks.presignGet.mockResolvedValue('https://s3.example.com/get-url');
  });

  it('persists metadata, logs an approval_history entry, and returns a download URL', async () => {
    const s3Key = `PR/${PR_ID}/01HXXXY-doc.pdf`;
    const result = await completeUpload(USER, {
      documentType: 'PR',
      documentId: PR_ID,
      s3Key,
      fileName: 'doc.pdf',
      fileType: 'application/pdf',
      fileSize: 1024,
    });
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        documentType: 'PR',
        documentId: PR_ID,
        s3Key,
        fileName: 'doc.pdf',
        fileSize: 1024,
        uploadedBy: 'user1',
      }),
    );
    expect(mocks.logHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        documentType: 'PR',
        documentId: PR_ID,
        action: 'Attachment Uploaded',
        comment: expect.stringContaining('doc.pdf'),
      }),
    );
    expect(result.downloadUrl).toBe('https://s3.example.com/get-url');
    expect(result.s3Key).toBe(s3Key);
  });

  it('rejects an s3Key that does not match the document scope', async () => {
    await expect(
      completeUpload(USER, {
        documentType: 'PR',
        documentId: PR_ID,
        s3Key: `PO/${PR_ID}/01HXXXY-doc.pdf`,
        fileName: 'doc.pdf',
        fileType: 'application/pdf',
        fileSize: 1024,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_S3_KEY' });
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.logHistory).not.toHaveBeenCalled();
  });

  it('rejects disallowed MIME on completion as a defense-in-depth check', async () => {
    await expect(
      completeUpload(USER, {
        documentType: 'PR',
        documentId: PR_ID,
        s3Key: `PR/${PR_ID}/01HXXXY-doc.exe`,
        fileName: 'doc.exe',
        fileType: 'application/x-msdownload',
        fileSize: 1024,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_FILE_TYPE' });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('blocks unauthorized user with FORBIDDEN', async () => {
    const err = new Error('Forbidden');
    err.code = 'FORBIDDEN';
    mocks.assertCanAccess.mockRejectedValueOnce(err);
    await expect(
      completeUpload(USER, {
        documentType: 'PR',
        documentId: PR_ID,
        s3Key: `PR/${PR_ID}/01HXXXY-doc.pdf`,
        fileName: 'doc.pdf',
        fileType: 'application/pdf',
        fileSize: 1024,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.logHistory).not.toHaveBeenCalled();
  });
});

describe('listAttachments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertCanAccess.mockResolvedValue({ _id: 'doc1' });
    mocks.presignGet.mockResolvedValue('https://s3.example.com/get-url');
    const rows = [
      {
        _id: { toString: () => 'a1' },
        fileName: 'one.pdf',
        fileType: 'application/pdf',
        fileSize: 512,
        s3Key: `PR/${PR_ID}/01-one.pdf`,
        uploadedAt: new Date('2026-05-20'),
        uploadedBy: { name: 'Alice' },
      },
    ];
    mocks.find.mockReturnValue({
      sort: () => ({
        populate: () => ({
          lean: () => Promise.resolve(rows),
        }),
      }),
    });
  });

  it('returns rows with fresh presigned download URLs and asserts access when user passed', async () => {
    const items = await listAttachments('PR', PR_ID, USER);
    expect(mocks.assertCanAccess).toHaveBeenCalledWith(USER, 'PR', PR_ID);
    expect(items).toHaveLength(1);
    expect(items[0].downloadUrl).toBe('https://s3.example.com/get-url');
    expect(items[0].uploadedBy).toBe('Alice');
  });

  it('skips access assertion when called without a user (legacy server-side caller)', async () => {
    await listAttachments('PR', PR_ID);
    expect(mocks.assertCanAccess).not.toHaveBeenCalled();
  });

  it('throws FORBIDDEN when the user cannot access the document', async () => {
    const err = new Error('Forbidden');
    err.code = 'FORBIDDEN';
    mocks.assertCanAccess.mockRejectedValueOnce(err);
    await expect(listAttachments('PR', PR_ID, USER)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});
