import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import User from '@/models/User';
import Role from '@/models/Role';
import { connectDB } from '@/lib/mongodb';
import { sanitizeUser } from '@/lib/authLogin';
import { buildPagination } from '@/lib/errors';

const BCRYPT_COST = 12;

function sanitizeUserRecord(user) {
  const base = sanitizeUser(user);
  if (!base) return null;
  return { ...base, __v: user.__v };
}

export async function listUsers({ page, limit, sort, order, q, status }) {
  await connectDB();

  const filter = {};
  if (q) {
    const regex = { $regex: q, $options: 'i' };
    filter.$or = [{ name: regex }, { email: regex }, { username: regex }];
  }
  if (status === 'active') filter.isActive = true;
  if (status === 'inactive') filter.isActive = false;

  const sortDir = order === 'asc' ? 1 : -1;
  const sortField = sort || 'createdAt';

  const [total, users] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter)
      .populate('role', 'name permissions')
      .sort({ [sortField]: sortDir })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ]);

  return {
    users: users.map((u) => sanitizeUserRecord({ ...u, roleName: u.role?.name })),
    pagination: buildPagination(page, limit, total),
  };
}

export async function getUserById(id) {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return null;
  }
  const user = await User.findById(id).populate('role', 'name permissions').lean();
  if (!user) return null;
  return sanitizeUserRecord({ ...user, roleName: user.role?.name });
}

async function assertRoleExists(roleId) {
  const role = await Role.findById(roleId).lean();
  if (!role) {
    const err = new Error('Role not found');
    err.code = 'ROLE_NOT_FOUND';
    throw err;
  }
  return role;
}

export async function createUser(data) {
  await connectDB();
  await assertRoleExists(data.role);

  const passwordHash = await bcrypt.hash(data.password, BCRYPT_COST);
  const username = data.username.trim();

  try {
    const user = await User.create({
      name: data.name.trim(),
      email: data.email.trim().toLowerCase(),
      username,
      passwordHash,
      role: data.role,
      department: data.department?.trim() || undefined,
      permissions: data.permissions || [],
      isActive: data.isActive !== false,
    });
    const populated = await User.findById(user._id).populate('role', 'name').lean();
    return sanitizeUserRecord({ ...populated, roleName: populated.role?.name });
  } catch (err) {
    if (err.code === 11000) {
      const dup = new Error('Username or email already exists');
      dup.code = 'DUPLICATE_USER';
      throw dup;
    }
    throw err;
  }
}

export async function updateUser(id, data) {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return { error: 'NOT_FOUND' };
  }

  const existing = await User.findById(id);
  if (!existing) {
    return { error: 'NOT_FOUND' };
  }

  if (data.__v !== undefined && existing.__v !== data.__v) {
    return { error: 'CONFLICT' };
  }

  if (data.role) {
    await assertRoleExists(data.role);
  }

  const updates = {};
  if (data.name !== undefined) updates.name = data.name.trim();
  if (data.email !== undefined) updates.email = data.email.trim().toLowerCase();
  if (data.username !== undefined) updates.username = data.username.trim();
  if (data.role !== undefined) updates.role = data.role;
  if (data.department !== undefined) updates.department = data.department || undefined;
  if (data.permissions !== undefined) updates.permissions = data.permissions;
  if (data.isActive !== undefined) updates.isActive = data.isActive;
  if (data.password) {
    updates.passwordHash = await bcrypt.hash(data.password, BCRYPT_COST);
    updates.failedLoginAttempts = 0;
    updates.lockedUntil = null;
  }

  try {
    const filter = { _id: id };
    if (data.__v !== undefined) filter.__v = data.__v;

    const updated = await User.findOneAndUpdate(filter, { $set: updates }, { new: true }).populate(
      'role',
      'name',
    );

    if (!updated) {
      return { error: data.__v !== undefined ? 'CONFLICT' : 'NOT_FOUND' };
    }

    const lean = updated.toObject();
    return { user: sanitizeUserRecord({ ...lean, roleName: lean.role?.name }) };
  } catch (err) {
    if (err.code === 11000) {
      const dup = new Error('Username or email already exists');
      dup.code = 'DUPLICATE_USER';
      throw dup;
    }
    throw err;
  }
}

export async function deactivateUser(id) {
  return updateUser(id, { isActive: false });
}
