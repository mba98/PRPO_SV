import { z } from 'zod';

const permissionKeyPattern = /^[a-z][a-z0-9._-]*$/i;

export const createPermissionSchema = z.object({
  key: z
    .string()
    .min(1, 'Permission key is required')
    .max(120)
    .regex(permissionKeyPattern, 'Use lowercase letters, numbers, dots, underscores'),
  label: z.string().min(1, 'Label is required').max(200),
  group: z.string().max(50).optional(),
  isActive: z.boolean().optional().default(true),
});

export const updatePermissionSchema = z.object({
  label: z.string().min(1).max(200).optional(),
  group: z.string().max(50).optional(),
  isActive: z.boolean().optional(),
  __v: z.number().int().nonnegative().optional(),
});

export const createDocumentTypeSchema = z.object({
  code: z.string().min(1, 'Code is required').max(50),
  label: z.string().min(1, 'Label is required').max(200),
  isActive: z.boolean().optional().default(true),
});

export const updateDocumentTypeSchema = z.object({
  label: z.string().min(1).max(200).optional(),
  isActive: z.boolean().optional(),
  __v: z.number().int().nonnegative().optional(),
});
