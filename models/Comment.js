import mongoose from 'mongoose';
import { schemaOptions } from './schemaOptions.js';

const commentSchema = new mongoose.Schema(
  {
    documentType: { type: String, enum: ['PR', 'PO', 'APRI'], required: true },
    documentId: { type: mongoose.Schema.Types.ObjectId, required: true },
    comment: { type: String, required: true },
    attachments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Attachment' }],
    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    postedAt: { type: Date, default: Date.now },
  },
  schemaOptions,
);

commentSchema.index({ documentType: 1, documentId: 1, postedAt: -1 });

export default mongoose.models.Comment || mongoose.model('Comment', commentSchema);
