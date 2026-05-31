import { z } from 'zod';

const documentTypeSchema = z.enum(['PR', 'PO', 'APRI']);
const objectIdSchema = z
  .string()
  .min(1, 'documentId is required')
  .regex(/^[a-fA-F0-9]{24}$/, 'documentId must be a 24-character hex string');

const fileSizeSchema = z.coerce
  .number()
  .positive('fileSize must be greater than zero')
  .max(25 * 1024 * 1024, 'fileSize must not exceed 25MB');

export const signUploadSchema = z.object({
  documentType: documentTypeSchema,
  documentId: objectIdSchema,
  fileName: z.string().trim().min(1, 'fileName is required').max(255),
  fileType: z.string().trim().min(1, 'fileType is required').max(255),
  fileSize: fileSizeSchema,
  approvalStep: z.union([z.string(), z.number()]).optional(),
});

export const completeUploadSchema = z.object({
  documentType: documentTypeSchema,
  documentId: objectIdSchema,
  s3Key: z.string().trim().min(1, 's3Key is required').max(1024),
  fileName: z.string().trim().min(1, 'fileName is required').max(255),
  originalFileName: z.string().trim().min(1).max(255).optional(),
  fileType: z.string().trim().min(1, 'fileType is required').max(255),
  fileSize: fileSizeSchema,
  approvalStep: z.union([z.string(), z.number()]).optional(),
});
