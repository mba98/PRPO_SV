import { z } from 'zod';

const optionalPositiveDocRate = z
  .union([z.coerce.number().positive(), z.literal('').transform(() => undefined), z.null()])
  .optional();

const poLineUpdateSchema = z.object({
  _id: z.string().optional(),
  itemCode: z.string().min(1, 'Item code is required'),
  itemName: z.string().optional(),
  quantity: z.coerce.number().positive('Quantity must be positive'),
  unitPrice: z.coerce.number().nonnegative('Unit price must be non-negative'),
  warehouseCode: z.string().optional(),
  uomCode: z.string().min(1).optional(),
  uom: z.string().optional(),
  remarks: z.string().optional(),
  vendor: z.string().optional(),
});

const poDocCurrencySchema = z.enum(['USD', 'IQD']).optional();

const poLineCreateFromPrSchema = poLineUpdateSchema.extend({
  relatedPRLineId: z.string().optional(),
});

export const createPoFromPrSchema = z.object({
  vendor: z.string().min(1, 'Vendor (CardCode) is required'),
  postingDate: z.union([z.string(), z.date()]).optional(),
  documentDate: z.union([z.string(), z.date()]).optional(),
  requiredDate: z.union([z.string(), z.date()]).optional(),
  dueDate: z.union([z.string(), z.date()]).optional(),
  docCurrency: poDocCurrencySchema,
  docRate: optionalPositiveDocRate,
  remarks: z.string().optional(),
  lines: z.array(poLineCreateFromPrSchema).min(1, 'At least one line is required'),
});

export const updatePurchaseOrderSchema = z.object({
  vendor: z.string().min(1).optional(),
  postingDate: z.union([z.string(), z.date()]).optional(),
  documentDate: z.union([z.string(), z.date()]).optional(),
  requiredDate: z.union([z.string(), z.date()]).optional(),
  dueDate: z.union([z.string(), z.date()]).optional(),
  docCurrency: poDocCurrencySchema,
  docRate: optionalPositiveDocRate,
  remarks: z.string().optional(),
  lines: z.array(poLineUpdateSchema).min(1, 'At least one line is required').optional(),
  __v: z.number().int().nonnegative().optional(),
});

export const approveRejectPoSchema = z.object({
  comment: z.string().optional(),
  __v: z.number().int().nonnegative().optional(),
});
