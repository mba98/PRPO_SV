import mongoose from 'mongoose';
import { schemaOptions } from './schemaOptions';

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
    remarks: String,
    status: {
      type: String,
      enum: [
        'Ready for AP Reserve Invoice',
        'Creating in SAP',
        'Created in SAP',
        'Failed to Create in SAP',
        'Completed',
      ],
      default: 'Ready for AP Reserve Invoice',
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

apReserveInvoiceSchema.index({ portalAPNumber: 1 }, { unique: true, sparse: true });
apReserveInvoiceSchema.index({ relatedPOId: 1 });
apReserveInvoiceSchema.index({ sapAPDocEntry: 1 });

export default mongoose.models.APReserveInvoice ||
  mongoose.model('APReserveInvoice', apReserveInvoiceSchema);
