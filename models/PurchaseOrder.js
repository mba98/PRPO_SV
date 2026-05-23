import mongoose from 'mongoose';
import { schemaOptions } from './schemaOptions.js';

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
      enum: [
        'Draft',
        'Pending Project Manager Approval',
        'Pending Finance Approval',
        'Approved',
        'Rejected',
        'Creating in SAP',
        'Created in SAP',
        'Failed to Create in SAP',
      ],
      default: 'Draft',
    },
    currentApprovalStep: { type: Number, default: 0 },
    sapPODocEntry: Number,
    sapPODocNum: String,
    sapCreationStatus: String,
    sapResponse: mongoose.Schema.Types.Mixed,
    sapErrorMessage: String,
    lines: [poLineSchema],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  schemaOptions,
);

purchaseOrderSchema.index({ portalPONumber: 1 }, { unique: true, sparse: true });
purchaseOrderSchema.index({ status: 1, currentApprovalStep: 1 });
purchaseOrderSchema.index({ relatedPRId: 1 });
purchaseOrderSchema.index({ relatedPRId: 1, vendor: 1 });
purchaseOrderSchema.index({ sapPODocEntry: 1 });

export default mongoose.models.PurchaseOrder ||
  mongoose.model('PurchaseOrder', purchaseOrderSchema);
