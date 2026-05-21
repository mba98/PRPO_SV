import { z } from 'zod';

export const createPoFromPrSchema = z.object({
  vendor: z.string().min(1, 'Vendor (CardCode) is required'),
});

export const updatePurchaseOrderSchema = z.object({
  remarks: z.string().optional(),
  requiredDate: z.union([z.string(), z.date()]).optional(),
  __v: z.number().int().nonnegative().optional(),
});

export const approveRejectPoSchema = z.object({
  comment: z.string().optional(),
  __v: z.number().int().nonnegative().optional(),
});
