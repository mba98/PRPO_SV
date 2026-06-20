import { z } from 'zod';

const documentTypeSchema = z.enum(['PR', 'PO', 'APRI', 'LOCAL_PURCHASE']);
const objectIdSchema = z
  .string()
  .min(1, 'documentId is required')
  .regex(/^[a-fA-F0-9]{24}$/, 'documentId must be a 24-character hex string');

export const COMMENT_MAX_LENGTH = 2000;

export const documentScopeSchema = z.object({
  documentType: documentTypeSchema,
  documentId: objectIdSchema,
});

export const createCommentSchema = z.object({
  documentType: documentTypeSchema,
  documentId: objectIdSchema,
  comment: z
    .string()
    .transform((value) => value.trim())
    .pipe(
      z
        .string()
        .min(1, 'Comment is required')
        .max(COMMENT_MAX_LENGTH, `Comment must be ${COMMENT_MAX_LENGTH} characters or less`),
    ),
  attachments: z.array(objectIdSchema).max(20).optional(),
});
