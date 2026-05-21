import mongoose from 'mongoose';
import { schemaOptions } from './schemaOptions.js';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    username: { type: String, required: true },
    passwordHash: { type: String, required: true },
    role: { type: mongoose.Schema.Types.ObjectId, ref: 'Role', required: true },
    department: { type: String },
    isActive: { type: Boolean, default: true },
    permissions: [{ type: String }],
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date },
  },
  schemaOptions,
);

userSchema.index({ username: 1 }, { unique: true });
userSchema.index({ email: 1 }, { unique: true });

export default mongoose.models.User || mongoose.model('User', userSchema);
