import { z } from 'zod';

const prLineSchema = z.object({
  itemCode: z.string().min(1, 'Item code is required'),
  itemName: z.string().optional(),
  vendor: z.string().optional(),
  quantity: z.coerce.number().positive('Quantity must be positive'),
  uom: z.string().optional(),
  warehouseCode: z.string().optional(),
  projectCode: z.string().optional(),
  costCenter: z.string().optional(),
  requiredDate: z.union([z.string(), z.date()]).optional(),
  estimatedUnitPrice: z.coerce.number().nonnegative().optional(),
  estimatedTotal: z.coerce.number().nonnegative().optional(),
  remarks: z.string().optional(),
  uDepartment: z.string().optional(),
  uDelDate: z.union([z.string(), z.date()]).optional(),
  uRate: z.coerce.number().optional(),
});

export const createPurchaseRequestSchema = z.object({
  department: z.string().min(1),
  project: z.string().optional(),
  requiredDate: z.union([z.string(), z.date()]),
  postingDate: z.union([z.string(), z.date()]).optional(),
  documentDate: z.union([z.string(), z.date()]).optional(),
  warehouse: z.string().optional(),
  remarks: z.string().optional(),
  lines: z.array(prLineSchema).min(1, 'At least one line item is required'),
});

export const updatePurchaseRequestSchema = createPurchaseRequestSchema.partial().extend({
  __v: z.number().int().nonnegative().optional(),
});

export const approveRejectSchema = z.object({
  comment: z.string().optional(),
  __v: z.number().int().nonnegative().optional(),
});

export const createSapItemSchema = z.object({
  ItemCode: z.string().min(1),
  ItemName: z.string().min(1),
  ItemGroup: z.string().optional(),
  UoMGroup: z.string().optional(),
  DefaultWarehouse: z.string().optional(),
  U_Model: z.string().optional(),
  U_PartNo: z.string().optional(),
  U_Category: z.string().optional(),
  U_FactoryName: z.string().optional(),
  U_Code: z.string().optional(),
  U_UOM: z.string().optional(),
  relatedPRNumber: z.string().optional(),
});
