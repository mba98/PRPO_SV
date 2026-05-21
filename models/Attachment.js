import mongoose from 'mongoose';
import { schemaOptions } from './schemaOptions';

const attachmentSchema = new mongoose.Schema(
  {
    documentType: { type: String, enum: ['PR', 'PO', 'APRI'], required: true },
    documentId: { type: mongoose.Schema.Types.ObjectId, required: true },
    approvalStep: Number,
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    uploadedAt: { type: Date, default: Date.now },
    fileName: String,
    fileType: String,
    fileSize: Number,
    s3Key: { type: String, unique: true, sparse: true },
    s3Url: String,
  },
  schemaOptions,
);

attachmentSchema.index({ documentType: 1, documentId: 1 });
attachmentSchema.index({ s3Key: 1 }, { unique: true, sparse: true });

export default mongoose.models.Attachment || mongoose.model('Attachment', attachmentSchema);
