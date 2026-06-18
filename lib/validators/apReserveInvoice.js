import { z } from 'zod';

export const createApriFromPoSchema = z.object({}).strict().optional();

export const retryApriSapSchema = z.object({
  __v: z.number().int().nonnegative().optional(),
});

export const createApriInSapSchema = z.object({
  __v: z.number().int().nonnegative(),
});

export const approveRejectApriSchema = z.object({
  comment: z.string().optional(),
  __v: z.number().int().nonnegative().optional(),
});

const apriLineQtySchema = z.object({
  _id: z.string().min(1),
  quantity: z.coerce.number().positive('Quantity must be positive'),
});

export const updateApriSchema = z.object({
  lines: z.array(apriLineQtySchema).min(1, 'At least one line is required'),
  __v: z.number().int().nonnegative(),
});
