import mongoose from 'mongoose';
import { schemaOptions } from './schemaOptions.js';

const systemSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    value: { type: mongoose.Schema.Types.Mixed, default: () => ({ seq: 0 }) },
  },
  schemaOptions,
);

systemSettingsSchema.index({ key: 1 }, { unique: true });

export default mongoose.models.SystemSettings ||
  mongoose.model('SystemSettings', systemSettingsSchema);
