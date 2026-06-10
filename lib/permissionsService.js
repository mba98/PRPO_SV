import mongoose from 'mongoose';
import '@/models/index.js';
import Permission from '@/models/Permission.js';
import Role from '@/models/Role.js';
import { connectDB } from '@/lib/mongodb';
import { ALL_PERMISSIONS, PERMISSION_GROUPS, PERMISSION_LABELS } from '@/lib/permissions.js';

export function sanitizePermission(doc) {
  if (!doc) return null;
  return {
    id: doc._id?.toString(),
    key: doc.key,
    label: doc.label,
    group: doc.group || '',
    isActive: doc.isActive !== false,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    __v: doc.__v,
  };
}

/** Seed defaults when collection is empty (idempotent). */
export async function ensureDefaultPermissions() {
  await connectDB();
  const count = await Permission.countDocuments();
  if (count > 0) return;

  const rows = [];
  for (const group of PERMISSION_GROUPS) {
    for (const key of group.permissions) {
      rows.push({
        key,
        label: PERMISSION_LABELS[key] || key,
        group: group.id,
        isActive: true,
      });
    }
  }
  for (const key of ALL_PERMISSIONS) {
    if (!rows.some((r) => r.key === key)) {
      rows.push({ key, label: PERMISSION_LABELS[key] || key, group: 'other', isActive: true });
    }
  }
  await Permission.insertMany(rows);
}

export async function listPermissions({ includeInactive = false } = {}) {
  await connectDB();
  await ensureDefaultPermissions();
  const filter = includeInactive ? {} : { isActive: { $ne: false } };
  const rows = await Permission.find(filter).sort({ group: 1, key: 1 }).lean();
  return rows.map(sanitizePermission);
}

export async function listPermissionGroups() {
  const permissions = await listPermissions();
  const byGroup = new Map();
  for (const perm of permissions) {
    const group = perm.group || 'other';
    if (!byGroup.has(group)) {
      const meta = PERMISSION_GROUPS.find((g) => g.id === group);
      byGroup.set(group, { id: group, label: meta?.label || group, permissions: [] });
    }
    byGroup.get(group).permissions.push(perm);
  }
  return [...byGroup.values()];
}

export async function createPermission(data) {
  await connectDB();
  const key = String(data.key || '').trim();
  try {
    const doc = await Permission.create({
      key,
      label: String(data.label || key).trim(),
      group: data.group?.trim() || 'custom',
      isActive: data.isActive !== false,
    });
    return sanitizePermission(doc.toObject());
  } catch (err) {
    if (err.code === 11000) {
      const dup = new Error('Permission key already exists');
      dup.code = 'DUPLICATE_PERMISSION';
      throw dup;
    }
    throw err;
  }
}

export async function updatePermission(id, data) {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(id)) return { error: 'NOT_FOUND' };
  const existing = await Permission.findById(id);
  if (!existing) return { error: 'NOT_FOUND' };
  if (data.__v != null && data.__v !== existing.__v) return { error: 'CONFLICT' };

  if (data.label != null) existing.label = String(data.label).trim();
  if (data.group != null) existing.group = String(data.group).trim();
  if (data.isActive != null) existing.isActive = data.isActive;
  await existing.save();
  return { permission: sanitizePermission(existing.toObject()) };
}

export async function deletePermission(id) {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(id)) return { error: 'NOT_FOUND' };
  const perm = await Permission.findById(id).lean();
  if (!perm) return { error: 'NOT_FOUND' };

  const inUse = await Role.countDocuments({ permissions: perm.key });
  if (inUse > 0) {
    return {
      error: 'PERMISSION_IN_USE',
      message: `Cannot delete permission: assigned to ${inUse} role(s)`,
    };
  }
  await Permission.findByIdAndDelete(id);
  return { deleted: true, id };
}
