import mongoose from 'mongoose';
import { schemaOptions } from './schemaOptions.js';

const approvalMatrixAuditSchema = new mongoose.Schema(
  {
    action: { type: String, required: true },
    documentType: String,
    stepId: mongoose.Schema.Types.ObjectId,
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    performedByName: String,
    oldValue: mongoose.Schema.Types.Mixed,
    newValue: mongoose.Schema.Types.Mixed,
    summary: String,
  },
  schemaOptions,
);

approvalMatrixAuditSchema.index({ createdAt: -1 });
approvalMatrixAuditSchema.index({ documentType: 1, createdAt: -1 });

export default mongoose.models.ApprovalMatrixAudit ||
  mongoose.model('ApprovalMatrixAudit', approvalMatrixAuditSchema);
