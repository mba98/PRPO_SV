import { z } from 'zod';
import { ALL_PERMISSIONS } from '@/lib/permissions';
import { objectIdSchema } from './common.js';

const permissionEnum = z.enum(ALL_PERMISSIONS);

export const createApprovalMatrixSchema = z.object({
  documentType: z.enum(['PR', 'PO', 'APRI']),
  stepOrder: z.number().int().positive('Step order must be a positive integer'),
  stepName: z.string().min(1, 'Step name is required').max(200),
  requiredPermission: permissionEnum,
  approverRole: objectIdSchema,
  isActive: z.boolean().optional().default(true),
});

export const updateApprovalMatrixSchema = z.object({
  documentType: z.enum(['PR', 'PO', 'APRI']).optional(),
  stepOrder: z.number().int().positive().optional(),
  stepName: z.string().min(1).max(200).optional(),
  requiredPermission: permissionEnum.optional(),
  approverRole: objectIdSchema.optional(),
  isActive: z.boolean().optional(),
  __v: z.number().int().nonnegative().optional(),
});
