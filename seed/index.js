import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import mongoose from 'mongoose';
import Role from '../models/Role.js';
import User from '../models/User.js';
import ApprovalMatrix from '../models/ApprovalMatrix.js';
import EmailGroup from '../models/EmailGroup.js';
import { DEFAULT_ROLES } from './roles.js';
import { DEFAULT_APPROVAL_MATRIX } from './approvalMatrix.js';
import { DEFAULT_EMAIL_GROUPS } from './emailGroups.js';
import { buildAdminUser, getAdminSeedCredentials, hashPassword } from './admin.js';

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), '.env.local');
  if (!existsSync(envPath)) {
    return;
  }
  const content = readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

async function assertEmptyDatabase() {
  const [userCount, roleCount] = await Promise.all([
    User.countDocuments(),
    Role.countDocuments(),
  ]);

  if (userCount > 0 || roleCount > 0) {
    throw new Error(
      'Seed refused: database is not empty. Run against a fresh database only.',
    );
  }
}

async function seedRoles() {
  const created = await Role.insertMany(DEFAULT_ROLES);
  const byName = Object.fromEntries(created.map((r) => [r.name, r]));
  return byName;
}

async function seedApprovalMatrix(roleByName) {
  const rows = DEFAULT_APPROVAL_MATRIX.map((row) => ({
    documentType: row.documentType,
    stepOrder: row.stepOrder,
    stepName: row.stepName,
    requiredPermission: row.requiredPermission,
    approverRole: roleByName[row.approverRoleName]._id,
    isActive: true,
  }));
  await ApprovalMatrix.insertMany(rows);
}

async function seedEmailGroups(roleByName) {
  const rows = DEFAULT_EMAIL_GROUPS.map((group) => ({
    eventKey: group.eventKey,
    recipients: group.roleNames.map((name) => ({
      role: roleByName[name]._id,
    })),
    ccRoles: [],
    isActive: true,
    updatedAt: new Date(),
  }));
  await EmailGroup.insertMany(rows);
}

async function seedAdminUser(roleByName) {
  getAdminSeedCredentials();
  const passwordHash = await hashPassword(process.env.SEED_ADMIN_PASSWORD);
  const adminRole = roleByName.Admin;
  await User.create(buildAdminUser(adminRole._id, passwordHash));
}

async function main() {
  loadEnvLocal();

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is required');
  }

  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  try {
    await assertEmptyDatabase();
    const roleByName = await seedRoles();
    console.log(`Seeded ${DEFAULT_ROLES.length} roles`);

    await seedApprovalMatrix(roleByName);
    console.log(`Seeded ${DEFAULT_APPROVAL_MATRIX.length} approval matrix rows`);

    await seedEmailGroups(roleByName);
    console.log(`Seeded ${DEFAULT_EMAIL_GROUPS.length} email groups`);

    await seedAdminUser(roleByName);
    console.log('Seeded admin user');

    console.log('Seed completed successfully');
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
