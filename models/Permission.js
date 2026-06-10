import mongoose from 'mongoose';
import { schemaOptions } from './schemaOptions.js';

const permissionSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    label: { type: String, required: true, trim: true },
    group: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
  },
  schemaOptions,
);

permissionSchema.index({ group: 1, key: 1 });

export default mongoose.models.Permission || mongoose.model('Permission', permissionSchema);
