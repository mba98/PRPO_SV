import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Role from '../models/Role.js';
import User from '../models/User.js';
import { loadEnvLocal } from '../lib/loadEnvLocal.js';
import { connectMongo, disconnectMongo, getMongoUriSummary } from '../lib/mongodb.js';
import { formatMongoConnectionError } from '../lib/mongodbUri.js';
import { hashPassword } from './admin.js';

function resolveAdminPassword() {
  const fromEnv = process.env.SEED_ADMIN_PASSWORD;
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SEED_ADMIN_PASSWORD must be set in production when seeding admin');
  }
  return 'Admin@123456';
}

export const DEFAULT_TEST_USERS = [
  {
    username: 'admin',
    email: 'admin@portal.local',
    name: 'Admin User',
    roleName: 'Admin',
    department: 'Administration',
    resolvePassword: resolveAdminPassword,
  },
  {
    username: 'requester',
    email: 'requester@portal.local',
    name: 'Requester User',
    roleName: 'Requester',
    department: 'Procurement',
    password: 'Requester@123',
  },
  {
    username: 'whs.approver',
    email: 'whs.approver@portal.local',
    name: 'WHS Approver User',
    roleName: 'WHS Approver',
    department: 'Warehouse',
    password: 'Whs@123456',
  },
  {
    username: 'project.manager',
    email: 'project.manager@portal.local',
    name: 'Project Manager User',
    roleName: 'Project Manager',
    department: 'Projects',
    password: 'PM@123456',
  },
  {
    username: 'finance',
    email: 'finance@portal.local',
    name: 'Finance User',
    roleName: 'Finance',
    department: 'Finance',
    password: 'Finance@123',
  },
  {
    username: 'procurement',
    email: 'procurement@portal.local',
    name: 'Procurement User',
    roleName: 'Procurement',
    department: 'Procurement',
    password: 'Procurement@123',
  },
];

export function assertCanSeedTestUsers() {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEFAULT_TEST_USERS !== 'true') {
    throw new Error(
      'Refused: default test users cannot be seeded in production without ALLOW_DEFAULT_TEST_USERS=true',
    );
  }
}

async function loadRoleByName() {
  const roles = await Role.find({}).lean();
  const roleByName = Object.fromEntries(roles.map((r) => [r.name, r]));
  const missing = [
    ...new Set(DEFAULT_TEST_USERS.map((u) => u.roleName).filter((name) => !roleByName[name])),
  ];
  if (missing.length > 0) {
    throw new Error(
      `Cannot seed users: missing roles (${missing.join(', ')}). Run npm run seed on a fresh database first.`,
    );
  }
  return roleByName;
}

/**
 * Upsert default test users (skips existing username or email).
 * @param {{ roleByName?: Record<string, { _id: import('mongoose').Types.ObjectId, permissions?: string[] }>, skipUsernames?: string[] }} [options]
 */
export async function seedDefaultUsers(options = {}) {
  assertCanSeedTestUsers();

  const roleByName = options.roleByName || (await loadRoleByName());
  const skipUsernames = new Set((options.skipUsernames || []).map((u) => u.toLowerCase()));

  const results = { created: [], skipped: [] };

  for (const spec of DEFAULT_TEST_USERS) {
    if (skipUsernames.has(spec.username.toLowerCase())) {
      results.skipped.push(spec.username);
      console.log(`Skipped user (already seeded by admin step): ${spec.username}`);
      continue;
    }

    const existing = await User.findOne({
      $or: [{ username: spec.username }, { email: spec.email }],
    }).lean();

    if (existing) {
      results.skipped.push(spec.username);
      console.log(`User already exists: ${spec.username}`);
      continue;
    }

    const role = roleByName[spec.roleName];
    const plainPassword = spec.resolvePassword ? spec.resolvePassword() : spec.password;
    const passwordHash = await hashPassword(plainPassword);

    await User.create({
      name: spec.name,
      email: spec.email,
      username: spec.username,
      passwordHash,
      role: role._id,
      department: spec.department,
      isActive: true,
      permissions: [],
    });

    results.created.push(spec.username);
    console.log(`Created user: ${spec.username}`);
  }

  return results;
}

async function main() {
  loadEnvLocal();

  if (!process.env.MONGODB_URI) {
    throw new Error(
      'MONGODB_URI is required. Copy .env.local.example to .env.local and set your Atlas URI.',
    );
  }

  const { summary } = getMongoUriSummary();
  if (summary?.ok) {
    console.log(`MongoDB target: ${summary.scheme}://${summary.hosts}`);
  }

  await connectMongo();
  console.log('Connected to MongoDB');

  try {
    const results = await seedDefaultUsers();
    console.log(
      `Default users seed completed (${results.created.length} created, ${results.skipped.length} skipped)`,
    );
  } finally {
    await disconnectMongo();
  }
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  main().catch((err) => {
    const message = err.cause ? formatMongoConnectionError(err.cause) : err.message;
    console.error('Seed users failed:', message);
    process.exit(1);
  });
}
