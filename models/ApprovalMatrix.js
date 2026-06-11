import mongoose from 'mongoose';
import { schemaOptions } from './schemaOptions.js';

const approvalMatrixSchema = new mongoose.Schema(
  {
    documentType: { type: String, required: true, trim: true, uppercase: true },
    stepOrder: { type: Number, required: true },
    stepName: { type: String, required: true },
    pendingStatus: { type: String, trim: true },
    requiredPermission: { type: String, required: true },
    approverRole: { type: mongoose.Schema.Types.ObjectId, ref: 'Role', required: true },
    isActive: { type: Boolean, default: true },
  },
  schemaOptions,
);

approvalMatrixSchema.index({ documentType: 1, stepOrder: 1 }, { unique: true });
approvalMatrixSchema.index({ documentType: 1, isActive: 1, stepOrder: 1 });

export default mongoose.models.ApprovalMatrix ||
  mongoose.model('ApprovalMatrix', approvalMatrixSchema);
