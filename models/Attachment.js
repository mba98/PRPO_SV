import mongoose from 'mongoose';
import { schemaOptions } from './schemaOptions.js';

const attachmentSchema = new mongoose.Schema(
  {
    documentType: { type: String, enum: ['PR', 'PO', 'APRI', 'LOCAL_PURCHASE'], required: true },
    documentId: { type: mongoose.Schema.Types.ObjectId, required: true },
    approvalStep: Number,
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    uploadedAt: { type: Date, default: Date.now },
    fileName: String,
    originalFileName: String,
    fileType: String,
    fileSize: Number,
    s3Key: { type: String, unique: true, sparse: true },
    s3Url: String,
  },
  schemaOptions,
);

attachmentSchema.index({ documentType: 1, documentId: 1 });

export default mongoose.models.Attachment || mongoose.model('Attachment', attachmentSchema);
