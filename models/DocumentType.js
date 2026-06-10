import mongoose from 'mongoose';
import { schemaOptions } from './schemaOptions.js';

const documentTypeSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    label: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true },
  },
  schemaOptions,
);

export default mongoose.models.DocumentType ||
  mongoose.model('DocumentType', documentTypeSchema);
