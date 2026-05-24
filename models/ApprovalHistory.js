import mongoose from 'mongoose';
import { schemaOptions } from './schemaOptions.js';

const approvalHistorySchema = new mongoose.Schema(
  {
    documentType: { type: String, enum: ['PR', 'PO', 'APRI'], required: true },
    documentId: { type: mongoose.Schema.Types.ObjectId, required: true },
    stepName: String,
    action: {
      type: String,
      enum: [
        'Created',
        'Submitted',
        'Approved',
        'Rejected',
        'SAP Created',
        'SAP Failed',
        'Email Sent',
        'Attachment Uploaded',
        'Comment Added',
        'Updated',
      ],
      required: true,
    },
    actionBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    actionByRole: String,
    comment: String,
    attachments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Attachment' }],
    actionDate: { type: Date, default: Date.now },
    previousStatus: String,
    newStatus: String,
  },
  schemaOptions,
);

approvalHistorySchema.index({ documentType: 1, documentId: 1, actionDate: -1 });

export default mongoose.models.ApprovalHistory ||
  mongoose.model('ApprovalHistory', approvalHistorySchema);
