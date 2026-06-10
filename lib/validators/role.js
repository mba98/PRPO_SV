import { z } from 'zod';

const permissionKeySchema = z.string().min(1).max(120);

export const createRoleSchema = z.object({
  name: z.string().min(1, 'Role name is required').max(100),
  permissions: z.array(permissionKeySchema).min(1, 'At least one permission is required'),
});

export const updateRoleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  permissions: z.array(permissionKeySchema).min(1).optional(),
  __v: z.number().int().nonnegative().optional(),
});
