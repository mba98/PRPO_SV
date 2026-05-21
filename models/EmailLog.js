import mongoose from 'mongoose';
import { schemaOptions } from './schemaOptions.js';

const emailLogSchema = new mongoose.Schema(
  {
    to: [{ type: String }],
    cc: [{ type: String }],
    subject: String,
    body: String,
    relatedDocumentType: String,
    relatedDocumentId: mongoose.Schema.Types.ObjectId,
    emailStatus: { type: String, enum: ['Sent', 'Failed'], required: true },
    sentAt: { type: Date, default: Date.now },
    errorMessage: String,
  },
  schemaOptions,
);

emailLogSchema.index({ relatedDocumentType: 1, relatedDocumentId: 1, sentAt: -1 });

export default mongoose.models.EmailLog || mongoose.model('EmailLog', emailLogSchema);
