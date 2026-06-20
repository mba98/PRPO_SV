import { z } from 'zod';
import { LP_CURRENCIES } from '@/lib/lpMoney.js';

const lpLineSchema = z.object({
  _id: z.string().optional(),
  description: z.string().min(1, 'Description is required'),
  quantity: z.coerce.number().positive('Quantity must be greater than zero'),
  unitPrice: z.coerce.number().min(0, 'Estimated price must be zero or greater'),
  notes: z.string().optional().nullable(),
});

const lpHeaderSchema = z.object({
  documentDate: z.coerce.date({ required_error: 'Request date is required' }),
  currency: z.enum(LP_CURRENCIES).default('IQD'),
  budget: z.coerce
    .number({ required_error: 'Budget is required', invalid_type_error: 'Budget must be a valid number' })
    .min(0, 'Budget must be zero or greater'),
  remarks: z.string().optional().nullable(),
  lines: z.array(lpLineSchema).min(1, 'At least one line is required'),
});

export const createLocalPurchaseSchema = lpHeaderSchema;

export const updateLocalPurchaseSchema = lpHeaderSchema.extend({
  __v: z.number().int().nonnegative(),
});

export const submitLocalPurchaseSchema = z.object({
  __v: z.number().int().nonnegative(),
});

export const approveRejectLocalPurchaseSchema = z.object({
  comment: z.string().optional(),
  __v: z.number().int().nonnegative(),
});

export const rejectLocalPurchaseSchema = z.object({
  comment: z.string().min(1, 'Rejection comment is required'),
  __v: z.number().int().nonnegative(),
});

export const cancelLocalPurchaseSchema = z.object({
  comment: z.string().optional(),
  __v: z.number().int().nonnegative(),
});
