import { describe, expect, it } from 'vitest';
import {
  signUploadSchema,
  completeUploadSchema,
} from '@/lib/validators/attachment.js';

const validObjectId = '64b8c1a52f5b1b2c3d4e5f60';

function baseSign(overrides = {}) {
  return {
    documentType: 'PR',
    documentId: validObjectId,
    fileName: 'invoice.pdf',
    fileType: 'application/pdf',
    fileSize: 1024,
    ...overrides,
  };
}

describe('attachment validators', () => {
  describe('signUploadSchema', () => {
    it('accepts a valid PR sign-upload payload', () => {
      const parsed = signUploadSchema.safeParse(baseSign());
      expect(parsed.success).toBe(true);
    });

    it('accepts PO and APRI documentTypes', () => {
      expect(signUploadSchema.safeParse(baseSign({ documentType: 'PO' })).success).toBe(true);
      expect(signUploadSchema.safeParse(baseSign({ documentType: 'APRI' })).success).toBe(true);
    });

    it('rejects unsupported documentType', () => {
      expect(signUploadSchema.safeParse(baseSign({ documentType: 'INV' })).success).toBe(false);
    });

    it('rejects invalid documentId', () => {
      expect(signUploadSchema.safeParse(baseSign({ documentId: 'not-an-id' })).success).toBe(false);
      expect(signUploadSchema.safeParse(baseSign({ documentId: '' })).success).toBe(false);
    });

    it('rejects fileSize over 25 MB', () => {
      const tooBig = baseSign({ fileSize: 26 * 1024 * 1024 });
      const parsed = signUploadSchema.safeParse(tooBig);
      expect(parsed.success).toBe(false);
    });

    it('rejects non-positive fileSize', () => {
      expect(signUploadSchema.safeParse(baseSign({ fileSize: 0 })).success).toBe(false);
      expect(signUploadSchema.safeParse(baseSign({ fileSize: -1 })).success).toBe(false);
    });

    it('requires fileName and fileType', () => {
      expect(signUploadSchema.safeParse(baseSign({ fileName: '' })).success).toBe(false);
      expect(signUploadSchema.safeParse(baseSign({ fileType: '' })).success).toBe(false);
    });

    it('accepts optional approvalStep', () => {
      const parsed = signUploadSchema.safeParse(baseSign({ approvalStep: 2 }));
      expect(parsed.success).toBe(true);
    });
  });

  describe('completeUploadSchema', () => {
    function baseComplete(overrides = {}) {
      return {
        ...baseSign(),
        s3Key: `PR/${validObjectId}/01HXXX-invoice.pdf`,
        ...overrides,
      };
    }

    it('accepts valid metadata', () => {
      expect(completeUploadSchema.safeParse(baseComplete()).success).toBe(true);
    });

    it('requires s3Key', () => {
      expect(completeUploadSchema.safeParse(baseComplete({ s3Key: '' })).success).toBe(false);
    });

    it('rejects fileSize over 25 MB', () => {
      expect(
        completeUploadSchema.safeParse(baseComplete({ fileSize: 30 * 1024 * 1024 })).success,
      ).toBe(false);
    });
  });
});
