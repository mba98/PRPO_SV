import bcrypt from 'bcrypt';
import '@/models/index.js';
import User from '@/models/User.js';
import { connectDB } from '@/lib/mongodb';
import { signToken } from '@/lib/auth';
import {
  checkLoginRateLimit,
  clearLoginRateLimit,
  recordFailedLoginAttempt,
} from '@/lib/rateLimit';

const LOCKOUT_THRESHOLD = 10;
const LOCKOUT_DURATION_MS = 30 * 60 * 1000;

export function sanitizeUser(user) {
  if (!user) return null;
  const { passwordHash, failedLoginAttempts, lockedUntil, role, ...safe } = user;
  const roleId = role?._id?.toString?.() ?? role?.toString?.();
  return {
    id: safe._id?.toString?.() ?? safe._id,
    name: safe.name,
    email: safe.email,
    username: safe.username,
    department: safe.department,
    isActive: safe.isActive,
    permissions: safe.permissions || [],
    roleName: safe.roleName || role?.name,
    role: roleId ? { id: roleId, name: role?.name } : undefined,
  };
}

async function loadUserByUsername(username) {
  await connectDB();
  const escaped = username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return User.findOne({ username: { $regex: new RegExp(`^${escaped}$`, 'i') } })
    .populate('role')
    .lean();
}

export async function authenticateUser(username, password, clientIp) {
  const normalizedUsername = username.trim().toLowerCase();

  const rateCheck = checkLoginRateLimit(clientIp, normalizedUsername);
  if (!rateCheck.allowed) {
    return {
      ok: false,
      status: 429,
      message: 'Too many login attempts. Please try again later.',
      error: 'RATE_LIMITED',
    };
  }

  const user = await loadUserByUsername(normalizedUsername);

  if (!user || !user.isActive) {
    recordFailedLoginAttempt(clientIp, normalizedUsername);
    return {
      ok: false,
      status: 401,
      message: 'Invalid username or password',
      error: 'INVALID_CREDENTIALS',
    };
  }

  if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
    return {
      ok: false,
      status: 423,
      message: 'Account is temporarily locked. Please try again later.',
      error: 'ACCOUNT_LOCKED',
    };
  }

  const passwordValid = await bcrypt.compare(password, user.passwordHash);

  if (!passwordValid) {
    recordFailedLoginAttempt(clientIp, normalizedUsername);
    const attempts = (user.failedLoginAttempts || 0) + 1;
    const update = { failedLoginAttempts: attempts };
    if (attempts >= LOCKOUT_THRESHOLD) {
      update.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
    }
    await User.updateOne({ _id: user._id }, { $set: update });

    return {
      ok: false,
      status: 401,
      message: 'Invalid username or password',
      error: 'INVALID_CREDENTIALS',
    };
  }

  await User.updateOne(
    { _id: user._id },
    { $set: { failedLoginAttempts: 0, lockedUntil: null } },
  );

  clearLoginRateLimit(clientIp, normalizedUsername);

  const rolePermissions = user.role?.permissions || [];
  const permissions = [...new Set([...rolePermissions, ...(user.permissions || [])])];

  const token = await signToken({
    userId: user._id.toString(),
    username: user.username,
  });

  const safeUser = sanitizeUser({
    ...user,
    permissions,
    roleName: user.role?.name,
  });

  return { ok: true, token, user: safeUser };
}
