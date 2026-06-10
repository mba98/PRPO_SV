import { z } from 'zod';
import { objectIdSchema } from './common.js';

const documentTypeSchema = z
  .string()
  .min(1, 'Document type is required')
  .max(50)
  .transform((v) => v.trim().toUpperCase());

const permissionKeySchema = z.string().min(1, 'Permission is required').max(120);

export const createApprovalMatrixSchema = z.object({
  documentType: documentTypeSchema,
  stepOrder: z.number().int().positive('Step order must be a positive integer').optional(),
  stepName: z.string().min(1, 'Step name is required').max(200),
  pendingStatus: z.string().max(200).optional(),
  requiredPermission: permissionKeySchema,
  approverRole: objectIdSchema,
  isActive: z.boolean().optional().default(true),
});

export const updateApprovalMatrixSchema = z.object({
  documentType: documentTypeSchema.optional(),
  stepName: z.string().min(1).max(200).optional(),
  pendingStatus: z.string().max(200).optional().nullable(),
  requiredPermission: permissionKeySchema.optional(),
  approverRole: objectIdSchema.optional(),
  isActive: z.boolean().optional(),
  __v: z.number().int().nonnegative().optional(),
});

export const reorderApprovalMatrixSchema = z.object({
  direction: z.enum(['up', 'down']),
});
