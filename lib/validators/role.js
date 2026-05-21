import { z } from 'zod';
import { ALL_PERMISSIONS } from '@/lib/permissions';

const permissionEnum = z.enum(ALL_PERMISSIONS);

export const createRoleSchema = z.object({
  name: z.string().min(1, 'Role name is required').max(100),
  permissions: z.array(permissionEnum).min(1, 'At least one permission is required'),
});

export const updateRoleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  permissions: z.array(permissionEnum).min(1).optional(),
  __v: z.number().int().nonnegative().optional(),
});
