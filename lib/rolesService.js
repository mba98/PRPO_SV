import mongoose from 'mongoose';
import '@/models/index.js';
import Role from '@/models/Role.js';
import User from '@/models/User.js';
import { connectDB } from '@/lib/mongodb';
import { buildPagination } from '@/lib/errors';
import { cacheDelete, cacheGet, cacheSet } from '@/lib/memoryCache.js';

const ROLES_PICKLIST_CACHE_KEY = 'roles:picklist';
const ROLES_PICKLIST_TTL_MS = 60_000;

export function sanitizeRole(role) {
  if (!role) return null;
  return {
    id: role._id?.toString?.() ?? role._id,
    name: role.name,
    permissions: role.permissions || [],
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
    __v: role.__v,
  };
}

export async function listRolesPicklist() {
  const cached = cacheGet(ROLES_PICKLIST_CACHE_KEY);
  if (cached) return cached;

  await connectDB();
  const roles = await Role.find({}).select('name').sort({ name: 1 }).lean();
  const result = roles.map((r) => ({ id: r._id.toString(), name: r.name }));
  cacheSet(ROLES_PICKLIST_CACHE_KEY, result, ROLES_PICKLIST_TTL_MS);
  return result;
}

function invalidateRolesPicklistCache() {
  cacheDelete(ROLES_PICKLIST_CACHE_KEY);
}

export async function listRoles({ page, limit, sort, order, q }) {
  await connectDB();

  const filter = {};
  if (q) {
    filter.name = { $regex: q, $options: 'i' };
  }

  const sortDir = order === 'asc' ? 1 : -1;
  const sortField = sort || 'name';

  const [total, roles] = await Promise.all([
    Role.countDocuments(filter),
    Role.find(filter)
      .sort({ [sortField]: sortDir })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ]);

  return {
    roles: roles.map(sanitizeRole),
    pagination: buildPagination(page, limit, total),
  };
}

export async function getRoleById(id) {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  const role = await Role.findById(id).lean();
  return sanitizeRole(role);
}

export async function countUsersWithRole(roleId) {
  await connectDB();
  return User.countDocuments({ role: roleId });
}

export async function createRole(data) {
  await connectDB();
  try {
    const role = await Role.create({
      name: data.name.trim(),
      permissions: data.permissions,
    });
    invalidateRolesPicklistCache();
    return sanitizeRole(role.toObject());
  } catch (err) {
    if (err.code === 11000) {
      const dup = new Error('Role name already exists');
      dup.code = 'DUPLICATE_ROLE';
      throw dup;
    }
    throw err;
  }
}

export async function updateRole(id, data) {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return { error: 'NOT_FOUND' };
  }

  const existing = await Role.findById(id);
  if (!existing) {
    return { error: 'NOT_FOUND' };
  }

  if (data.__v !== undefined && existing.__v !== data.__v) {
    return { error: 'CONFLICT' };
  }

  const updates = {};
  if (data.name !== undefined) updates.name = data.name.trim();
  if (data.permissions !== undefined) updates.permissions = data.permissions;

  try {
    const filter = { _id: id };
    if (data.__v !== undefined) filter.__v = data.__v;

    const updated = await Role.findOneAndUpdate(filter, { $set: updates }, { new: true });
    if (!updated) {
      return { error: data.__v !== undefined ? 'CONFLICT' : 'NOT_FOUND' };
    }
    invalidateRolesPicklistCache();
    return { role: sanitizeRole(updated.toObject()) };
  } catch (err) {
    if (err.code === 11000) {
      const dup = new Error('Role name already exists');
      dup.code = 'DUPLICATE_ROLE';
      throw dup;
    }
    throw err;
  }
}

export async function deleteRole(id) {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return { error: 'NOT_FOUND' };
  }

  const role = await Role.findById(id).lean();
  if (!role) {
    return { error: 'NOT_FOUND' };
  }

  const assignedCount = await countUsersWithRole(id);
  if (assignedCount > 0) {
    return {
      error: 'ROLE_IN_USE',
      message: `Cannot delete role: ${assignedCount} user(s) are assigned to this role`,
    };
  }

  await Role.findByIdAndDelete(id);
  invalidateRolesPicklistCache();
  return { deleted: true, id };
}
