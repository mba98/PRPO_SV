import mongoose from 'mongoose';
import { schemaOptions } from './schemaOptions.js';
import { LP_MODEL_STATUS_ENUM, LP_STATUS } from '../lib/localPurchaseStatus.js';

const LP_CURRENCIES = ['IQD', 'USD'];

const lpLineSchema = new mongoose.Schema(
  {
    description: { type: String, required: true },
    quantity: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
    lineTotal: { type: Number, default: 0 },
    notes: String,
  },
  { _id: true, strict: false },
);

const localPurchaseSchema = new mongoose.Schema(
  {
    portalLPNumber: { type: String },
    documentDate: { type: Date, required: true },
    currency: { type: String, enum: LP_CURRENCIES, default: 'IQD', required: true },
    budget: { type: Number, required: true, default: 0, min: 0 },
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
    rejectedAt: Date,
    rejectionReason: String,
    cancelledAt: Date,
    // Legacy optional fields — ignored by new forms, kept for older records.
    requiredDate: Date,
    projectCode: String,
    projectName: String,
    vendorName: String,
    vendorReference: String,
    exchangeRate: Number,
  },
  schemaOptions,
);

localPurchaseSchema.index({ portalLPNumber: 1 }, { unique: true, sparse: true });
localPurchaseSchema.index({ status: 1, currentApprovalStep: 1 });
localPurchaseSchema.index({ createdBy: 1, createdAt: -1 });
localPurchaseSchema.index({ createdAt: -1 });

export default mongoose.models.LocalPurchase ||
  mongoose.model('LocalPurchase', localPurchaseSchema);
