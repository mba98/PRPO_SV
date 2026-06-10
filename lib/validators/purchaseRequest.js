import { z } from 'zod';

const prLineSchema = z.object({
  // Required (simplified) line fields.
  itemCode: z.string().min(1, 'Item code is required'),
  quantity: z.coerce.number().positive('Quantity must be positive'),
  estimatedUnitPrice: z.coerce.number().nonnegative('Estimated unit price is required'),
  warehouseCode: z.string().min(1, 'Warehouse is required').optional(),
  // Optional line fields.
  vendor: z.string().optional(),
  remarks: z.string().optional(),
  // Legacy / backward-compatible fields — accepted but never required.
  itemName: z.string().optional(),
  uom: z.string().optional(),
  uomCode: z.string().min(1).optional(),
  projectCode: z.string().optional(),
  costCenter: z.string().optional(),
  requiredDate: z.union([z.string(), z.date()]).optional(),
  estimatedTotal: z.coerce.number().nonnegative().optional(),
  uDepartment: z.string().optional(),
  uDelDate: z.union([z.string(), z.date()]).optional(),
  uRate: z.coerce.number().optional(),
});

export const createPurchaseRequestSchema = z.object({
  // Required (simplified) header fields.
  requiredDate: z.union([z.string(), z.date()]),
  documentDate: z.union([z.string(), z.date()]).optional(),
  dueDate: z.union([z.string(), z.date()]).optional(),
  // Optional header fields.
  remarks: z.string().optional(),
  // Legacy / backward-compatible header fields — accepted but never required.
  department: z.string().optional(),
  project: z.string().optional(),
  postingDate: z.union([z.string(), z.date()]).optional(),
  warehouse: z.string().optional(),
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
  ItemCode: z.string().optional(),
  ItemName: z.string().min(1),
  ItemGroup: z.string().optional(),
  UgpEntry: z.coerce.number().int().positive().optional(),
  /** @deprecated use UgpEntry — kept for backward compatibility */
  UoMGroup: z.coerce.number().int().positive().optional(),
  DefaultWarehouse: z.string().optional(),
  U_Model: z.string().optional(),
  U_PartNo: z.string().optional(),
  U_Category: z.string().optional(),
  U_FactoryName: z.string().optional(),
  U_Code: z.string().optional(),
  U_UOM: z.string().optional(),
  relatedPRNumber: z.string().optional(),
});
