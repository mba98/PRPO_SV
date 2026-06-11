import mongoose from 'mongoose';
import { schemaOptions } from './schemaOptions.js';
import { PO_MODEL_STATUS_ENUM, PO_STATUS } from '@/lib/poStatus.js';

const poLineSchema = new mongoose.Schema(
  {
    relatedPRLineId: mongoose.Schema.Types.ObjectId,
    itemCode: String,
    itemName: String,
    quantity: Number,
    uom: String,
    uomCode: String,
    warehouseCode: String,
    projectCode: String,
    costCenter: String,
    unitPrice: Number,
    lineTotal: Number,
    remarks: String,
    uDepartment: String,
    uDelDate: Date,
    uRate: Number,
    sapPRBaseLine: Number,
  },
  { _id: true },
);

const purchaseOrderSchema = new mongoose.Schema(
  {
    portalPONumber: { type: String, unique: true, sparse: true },
    relatedPRId: { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseRequest' },
    relatedPRNumber: String,
    relatedSAPPRDocEntry: Number,
    relatedSAPPRDocNum: String,
    requester: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    department: String,
    project: String,
    vendor: String,
    warehouse: String,
    postingDate: Date,
    documentDate: Date,
    requiredDate: Date,
    dueDate: Date,
    docRate: Number,
    remarks: String,
    status: {
      type: String,
      enum: PO_MODEL_STATUS_ENUM,
      default: PO_STATUS.DRAFT,
    },
    currentApprovalStep: { type: Number, default: 0 },
    sapPODocEntry: Number,
    sapPODocNum: String,
    sapCreationStatus: String,
    sapPOStatus: String,
    sapCreatedAt: Date,
    sapWarnings: String,
    sapResponse: mongoose.Schema.Types.Mixed,
    sapErrorMessage: String,
    docCurrency: String,
    lines: [poLineSchema],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  schemaOptions,
);

purchaseOrderSchema.index({ status: 1, currentApprovalStep: 1 });
purchaseOrderSchema.index({ relatedPRId: 1 });
purchaseOrderSchema.index({ relatedPRId: 1, vendor: 1 });
purchaseOrderSchema.index({ sapPODocEntry: 1 });
purchaseOrderSchema.index({ createdAt: -1 });
purchaseOrderSchema.index({ requester: 1, createdAt: -1 });
purchaseOrderSchema.index({ createdBy: 1, createdAt: -1 });

export default mongoose.models.PurchaseOrder ||
  mongoose.model('PurchaseOrder', purchaseOrderSchema);
