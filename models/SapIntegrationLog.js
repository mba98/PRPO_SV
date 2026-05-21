import mongoose from 'mongoose';
import { schemaOptions } from './schemaOptions';

const sapIntegrationLogSchema = new mongoose.Schema(
  {
    documentType: String,
    documentId: mongoose.Schema.Types.ObjectId,
    action: String,
    requestPayload: mongoose.Schema.Types.Mixed,
    responsePayload: mongoose.Schema.Types.Mixed,
    sapDocEntry: Number,
    sapDocNum: String,
    status: { type: String, enum: ['Success', 'Failed'], required: true },
    errorMessage: String,
  },
  schemaOptions,
);

sapIntegrationLogSchema.index({ documentType: 1, documentId: 1, createdAt: -1 });

export default mongoose.models.SapIntegrationLog ||
  mongoose.model('SapIntegrationLog', sapIntegrationLogSchema);
