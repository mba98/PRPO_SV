import mongoose from 'mongoose';
import { schemaOptions } from './schemaOptions.js';
import { LP_MODEL_STATUS_ENUM, LP_STATUS } from '../lib/localPurchaseStatus.js';

const lpLineSchema = new mongoose.Schema(
  {
    description: { type: String, required: true },
    uom: String,
    quantity: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
    lineTotal: { type: Number, default: 0 },
    notes: String,
  },
  { _id: true },
);

const localPurchaseSchema = new mongoose.Schema(
  {
    portalLPNumber: { type: String, sparse: true },
    documentDate: { type: Date, required: true },
    requiredDate: Date,
    projectCode: { type: String, required: true },
    projectName: String,
    vendorName: { type: String, required: true },
    vendorReference: String,
    currency: { type: String, required: true },
    exchangeRate: { type: Number, default: 1 },
    remarks: String,
    lines: { type: [lpLineSchema], default: [] },
    documentTotal: { type: Number, default: 0 },
    status: {
      type: String,
      enum: LP_MODEL_STATUS_ENUM,
      default: LP_STATUS.DRAFT,
    },
    currentApprovalStep: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    submittedAt: Date,
    completedAt: Date,
    cancelledAt: Date,
    rejectionReason: String,
  },
  schemaOptions,
);

localPurchaseSchema.index({ portalLPNumber: 1 }, { unique: true, sparse: true });
localPurchaseSchema.index({ status: 1, currentApprovalStep: 1 });
localPurchaseSchema.index({ createdBy: 1, createdAt: -1 });
localPurchaseSchema.index({ projectCode: 1, createdAt: -1 });
localPurchaseSchema.index({ vendorName: 1 });
localPurchaseSchema.index({ createdAt: -1 });

export default mongoose.models.LocalPurchase ||
  mongoose.model('LocalPurchase', localPurchaseSchema);
