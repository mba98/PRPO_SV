import mongoose from 'mongoose';
import { schemaOptions } from './schemaOptions';

const itemCreationLogSchema = new mongoose.Schema(
  {
    itemCode: String,
    itemName: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    sapResponse: mongoose.Schema.Types.Mixed,
    status: String,
    errorMessage: String,
    relatedPRNumber: String,
  },
  schemaOptions,
);

export default mongoose.models.ItemCreationLog ||
  mongoose.model('ItemCreationLog', itemCreationLogSchema);
