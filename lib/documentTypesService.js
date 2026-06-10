import mongoose from 'mongoose';
import '@/models/index.js';
import DocumentType from '@/models/DocumentType.js';
import { connectDB } from '@/lib/mongodb';

const DEFAULT_TYPES = [
  { code: 'PR', label: 'Purchase Request' },
  { code: 'PO', label: 'Purchase Order' },
  { code: 'APRI', label: 'A/P Reserve Invoice' },
];

export function sanitizeDocumentType(doc) {
  if (!doc) return null;
  return {
    id: doc._id?.toString(),
    code: doc.code,
    label: doc.label,
    isActive: doc.isActive !== false,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    __v: doc.__v,
  };
}

export async function ensureDefaultDocumentTypes() {
  await connectDB();
  for (const row of DEFAULT_TYPES) {
    await DocumentType.updateOne(
      { code: row.code },
      { $setOnInsert: { ...row, isActive: true } },
      { upsert: true },
    );
  }
}

export async function listDocumentTypes({ includeInactive = false } = {}) {
  await connectDB();
  await ensureDefaultDocumentTypes();
  const filter = includeInactive ? {} : { isActive: { $ne: false } };
  const rows = await DocumentType.find(filter).sort({ code: 1 }).lean();
  return rows.map(sanitizeDocumentType);
}

export async function createDocumentType(data) {
  await connectDB();
  const code = String(data.code || '').trim().toUpperCase();
  try {
    const doc = await DocumentType.create({
      code,
      label: String(data.label || code).trim(),
      isActive: data.isActive !== false,
    });
    return sanitizeDocumentType(doc.toObject());
  } catch (err) {
    if (err.code === 11000) {
      const dup = new Error('Document type code already exists');
      dup.code = 'DUPLICATE_DOCUMENT_TYPE';
      throw dup;
    }
    throw err;
  }
}

export async function updateDocumentType(id, data) {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(id)) return { error: 'NOT_FOUND' };
  const existing = await DocumentType.findById(id);
  if (!existing) return { error: 'NOT_FOUND' };
  if (data.__v != null && data.__v !== existing.__v) return { error: 'CONFLICT' };
  if (data.label != null) existing.label = String(data.label).trim();
  if (data.isActive != null) existing.isActive = data.isActive;
  await existing.save();
  return { documentType: sanitizeDocumentType(existing.toObject()) };
}

export async function deleteDocumentType(id) {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(id)) return { error: 'NOT_FOUND' };
  const doc = await DocumentType.findById(id);
  if (!doc) return { error: 'NOT_FOUND' };
  await doc.deleteOne();
  return { deleted: true, id };
}
