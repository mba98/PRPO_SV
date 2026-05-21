import mongoose from 'mongoose';
import { schemaOptions } from './schemaOptions';

const approvalMatrixSchema = new mongoose.Schema(
  {
    documentType: { type: String, enum: ['PR', 'PO'], required: true },
    stepOrder: { type: Number, required: true },
    stepName: { type: String, required: true },
    requiredPermission: { type: String, required: true },
    approverRole: { type: mongoose.Schema.Types.ObjectId, ref: 'Role', required: true },
    isActive: { type: Boolean, default: true },
  },
  schemaOptions,
);

approvalMatrixSchema.index({ documentType: 1, stepOrder: 1 }, { unique: true });

export default mongoose.models.ApprovalMatrix ||
  mongoose.model('ApprovalMatrix', approvalMatrixSchema);
