import { z } from 'zod';
import { objectIdSchema } from './common';

const permissionsSchema = z.array(z.string().min(1)).optional().default([]);

export const createUserSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  email: z.string().email('Valid email is required').max(200),
  username: z.string().min(1, 'Username is required').max(100),
  password: z.string().min(8, 'Password must be at least 8 characters').max(200),
  role: objectIdSchema,
  department: z.string().max(200).optional(),
  permissions: permissionsSchema,
  isActive: z.boolean().optional().default(true),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  email: z.string().email().max(200).optional(),
  username: z.string().min(1).max(100).optional(),
  password: z.string().min(8).max(200).optional(),
  role: objectIdSchema.optional(),
  department: z.string().max(200).optional().nullable(),
  permissions: permissionsSchema,
  isActive: z.boolean().optional(),
  __v: z.number().int().nonnegative().optional(),
});
