import mongoose from 'mongoose';
import { schemaOptions } from './schemaOptions.js';

const systemSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    type: { type: String },
    seq: { type: Number, default: 0 },
    value: { type: mongoose.Schema.Types.Mixed },
  },
  schemaOptions,
);

systemSettingsSchema.index({ key: 1 }, { unique: true });

export default mongoose.models.SystemSettings ||
  mongoose.model('SystemSettings', systemSettingsSchema);
