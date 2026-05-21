import mongoose from 'mongoose';
import { schemaOptions } from './schemaOptions.js';

const roleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    permissions: [{ type: String }],
  },
  schemaOptions,
);

roleSchema.index({ name: 1 }, { unique: true });

export default mongoose.models.Role || mongoose.model('Role', roleSchema);
