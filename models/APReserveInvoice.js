import mongoose from 'mongoose';
import { schemaOptions } from './schemaOptions.js';
import { APRI_MODEL_STATUS_ENUM } from '@/lib/apriStatus.js';

const apriLineSchema = new mongoose.Schema(
  {
    relatedPOLineId: mongoose.Schema.Types.ObjectId,
    relatedPOLineNum: Number,
    itemCode: String,
    itemName: String,
    quantity: Number,
    uom: String,
    warehouseCode: String,
    projectCode: String,
    costCenter: String,
    unitPrice: Number,
    lineTotal: Number,
    remarks: String,
  },
  { _id: true },
);

const apReserveInvoiceSchema = new mongoose.Schema(
  {
    portalAPNumber: { type: String, unique: true, sparse: true },
    relatedPOId: { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseOrder' },
    relatedPONumber: String,
    relatedSAPPODocEntry: Number,
    relatedSAPPODocNum: String,
    vendor: String,
    postingDate: Date,
    documentDate: Date,
    dueDate: Date,
    taxDate: Date,
    docCurrency: String,
    docRate: Number,
    remarks: String,
    currentApprovalStep: { type: Number, default: 0 },
    status: {
      type: String,
      enum: APRI_MODEL_STATUS_ENUM,
      default: 'draft',
    },
    sapAPDocEntry: Number,
    sapAPDocNum: String,
    sapCreationStatus: String,
    sapResponse: mongoose.Schema.Types.Mixed,
    sapErrorMessage: String,
    lines: [apriLineSchema],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  schemaOptions,
);

apReserveInvoiceSchema.index({ relatedPOId: 1 });
apReserveInvoiceSchema.index({ sapAPDocEntry: 1 });
apReserveInvoiceSchema.index({ status: 1, createdAt: -1 });
apReserveInvoiceSchema.index({ vendor: 1 });
apReserveInvoiceSchema.index({ status: 1, currentApprovalStep: 1 });
apReserveInvoiceSchema.index({ createdBy: 1, createdAt: -1 });

export default mongoose.models.APReserveInvoice ||
  mongoose.model('APReserveInvoice', apReserveInvoiceSchema);
