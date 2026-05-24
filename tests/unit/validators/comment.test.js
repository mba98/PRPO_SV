import { describe, expect, it } from 'vitest';
import {
  createCommentSchema,
  documentScopeSchema,
  COMMENT_MAX_LENGTH,
} from '@/lib/validators/comment.js';

const validObjectId = '64b8c1a52f5b1b2c3d4e5f60';

function baseBody(overrides = {}) {
  return {
    documentType: 'PR',
    documentId: validObjectId,
    comment: 'Looks good — proceed.',
    ...overrides,
  };
}

describe('comment validators', () => {
  describe('createCommentSchema', () => {
    it('accepts a valid body and trims the comment', () => {
      const parsed = createCommentSchema.safeParse(baseBody({ comment: '  Approved  ' }));
      expect(parsed.success).toBe(true);
      expect(parsed.data.comment).toBe('Approved');
    });

    it('accepts PO and APRI document types', () => {
      expect(createCommentSchema.safeParse(baseBody({ documentType: 'PO' })).success).toBe(true);
      expect(createCommentSchema.safeParse(baseBody({ documentType: 'APRI' })).success).toBe(true);
    });

    it('rejects empty / whitespace-only comments', () => {
      expect(createCommentSchema.safeParse(baseBody({ comment: '' })).success).toBe(false);
      expect(createCommentSchema.safeParse(baseBody({ comment: '   ' })).success).toBe(false);
    });

    it('rejects comments longer than the documented max', () => {
      const longText = 'a'.repeat(COMMENT_MAX_LENGTH + 1);
      expect(createCommentSchema.safeParse(baseBody({ comment: longText })).success).toBe(false);
    });

    it('rejects unsupported documentType', () => {
      expect(createCommentSchema.safeParse(baseBody({ documentType: 'INV' })).success).toBe(false);
    });

    it('rejects invalid documentId', () => {
      expect(createCommentSchema.safeParse(baseBody({ documentId: 'bad' })).success).toBe(false);
    });

    it('accepts optional attachments as an array of ObjectIds', () => {
      const parsed = createCommentSchema.safeParse(
        baseBody({ attachments: [validObjectId, '64b8c1a52f5b1b2c3d4e5f61'] }),
      );
      expect(parsed.success).toBe(true);
    });

    it('rejects attachments with invalid ids', () => {
      const parsed = createCommentSchema.safeParse(
        baseBody({ attachments: ['nope'] }),
      );
      expect(parsed.success).toBe(false);
    });
  });

  describe('documentScopeSchema', () => {
    it('accepts valid PR/PO/APRI params', () => {
      expect(
        documentScopeSchema.safeParse({ documentType: 'PR', documentId: validObjectId }).success,
      ).toBe(true);
    });

    it('rejects unsupported documentType', () => {
      expect(
        documentScopeSchema.safeParse({ documentType: 'INV', documentId: validObjectId }).success,
      ).toBe(false);
    });

    it('rejects invalid documentId', () => {
      expect(
        documentScopeSchema.safeParse({ documentType: 'PR', documentId: 'oops' }).success,
      ).toBe(false);
    });
  });
});
