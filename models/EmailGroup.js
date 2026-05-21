import mongoose from 'mongoose';
import { schemaOptions } from './schemaOptions';

const recipientSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    email: String,
    role: { type: mongoose.Schema.Types.ObjectId, ref: 'Role' },
  },
  { _id: false },
);

const emailGroupSchema = new mongoose.Schema(
  {
    eventKey: { type: String, required: true },
    recipients: [recipientSchema],
    ccRoles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Role' }],
    isActive: { type: Boolean, default: true },
    updatedAt: { type: Date, default: Date.now },
  },
  { ...schemaOptions, timestamps: { createdAt: false, updatedAt: true } },
);

emailGroupSchema.index({ eventKey: 1 }, { unique: true });

export default mongoose.models.EmailGroup || mongoose.model('EmailGroup', emailGroupSchema);
