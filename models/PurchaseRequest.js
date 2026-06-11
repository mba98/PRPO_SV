import mongoose from 'mongoose';
import { schemaOptions } from './schemaOptions.js';

const prLineSchema = new mongoose.Schema(
  {
    itemCode: String,
    itemName: String,
    vendor: String,
    quantity: Number,
    uom: String,
    uomCode: String,
    ugpEntry: Number,
    ugpName: String,
    warehouseCode: String,
    projectCode: String,
    costCenter: String,
    requiredDate: Date,
    estimatedUnitPrice: Number,
    estimatedTotal: Number,
    remarks: String,
    uDepartment: String,
    uDelDate: Date,
    uRate: Number,
    orderedQty: { type: Number, default: 0 },
  },
  { _id: true },
);

const purchaseRequestSchema = new mongoose.Schema(
  {
    portalPRNumber: { type: String, unique: true, sparse: true },
    requester: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    requesterEmail: String,
    department: String,
    project: String,
    requiredDate: Date,
    dueDate: Date,
    postingDate: Date,
    documentDate: Date,
    warehouse: String,
    remarks: String,
    status: {
      type: String,
      enum: [
        'Draft',
        'Pending Warehouse Approval',
        'Pending Project Manager Approval',
        'Approved',
        'Rejected',
        'Creating in SAP',
        'Created in SAP',
        'Failed to Create in SAP',
        'Partially Ordered',
        'Fully Ordered',
      ],
      default: 'Draft',
    },
    currentApprovalStep: { type: Number, default: 0 },
    sapPRDocEntry: Number,
    sapPRDocNum: String,
    sapCreationStatus: String,
    sapResponse: mongoose.Schema.Types.Mixed,
    sapErrorMessage: String,
    sapPODocEntry: Number,
    sapPODocNum: String,
    sapPOCreationStatus: String,
    sapPOErrorMessage: String,
    sapPOResponse: mongoose.Schema.Types.Mixed,
    relatedPortalPONumber: String,
    lines: [prLineSchema],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  schemaOptions,
);

purchaseRequestSchema.index({ status: 1, currentApprovalStep: 1 });
purchaseRequestSchema.index({ requester: 1, createdAt: -1 });
purchaseRequestSchema.index({ sapPRDocEntry: 1 });
purchaseRequestSchema.index({ sapPRDocNum: 1 });
purchaseRequestSchema.index({ department: 1, createdAt: -1 });
purchaseRequestSchema.index({ project: 1 });
purchaseRequestSchema.index({ warehouse: 1 });
purchaseRequestSchema.index({ createdAt: -1 });
purchaseRequestSchema.index({ createdBy: 1, createdAt: -1 });

export default mongoose.models.PurchaseRequest ||
  mongoose.model('PurchaseRequest', purchaseRequestSchema);
