import { z } from 'zod';

const lpLineSchema = z.object({
  _id: z.string().optional(),
  description: z.string().min(1, 'Description is required'),
  uom: z.string().optional().nullable(),
  quantity: z.coerce.number().positive('Quantity must be greater than zero'),
  unitPrice: z.coerce.number().min(0, 'Unit price must be zero or greater'),
  notes: z.string().optional().nullable(),
});

const lpHeaderSchema = z.object({
  documentDate: z.coerce.date({ required_error: 'Document date is required' }),
  requiredDate: z.coerce.date().optional().nullable(),
  projectCode: z.string().min(1, 'Project is required'),
  projectName: z.string().optional().nullable(),
  vendorName: z.string().min(1, 'Vendor name is required'),
  vendorReference: z.string().optional().nullable(),
  currency: z.string().min(1, 'Currency is required'),
  exchangeRate: z.coerce.number().positive('Exchange rate must be greater than zero').default(1),
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
