import Role from '../models/Role.js';
import User from '../models/User.js';
import ApprovalMatrix from '../models/ApprovalMatrix.js';
import EmailGroup from '../models/EmailGroup.js';
import { loadEnvLocal } from '../lib/loadEnvLocal.js';
import { connectMongo, disconnectMongo, getMongoUriSummary } from '../lib/mongodb.js';
import { formatMongoConnectionError } from '../lib/mongodbUri.js';
import { DEFAULT_ROLES } from './roles.js';
import { DEFAULT_APPROVAL_MATRIX } from './approvalMatrix.js';
import { DEFAULT_EMAIL_GROUPS } from './emailGroups.js';
import { buildAdminUser, getAdminSeedCredentials, hashPassword } from './admin.js';
import { seedDefaultUsers } from './users.js';
import { upsertSapPrSettings } from './settings.js';

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
    await assertEmptyDatabase();
    const roleByName = await seedRoles();
    console.log(`Seeded ${DEFAULT_ROLES.length} roles`);

    await seedApprovalMatrix(roleByName);
    console.log(`Seeded ${DEFAULT_APPROVAL_MATRIX.length} approval matrix rows`);

    await seedEmailGroups(roleByName);
    console.log(`Seeded ${DEFAULT_EMAIL_GROUPS.length} email groups`);

    await seedAdminUser(roleByName);
    console.log('Seeded admin user');

    const adminUsername = process.env.SEED_ADMIN_USERNAME?.trim();
    const userResults = await seedDefaultUsers({
      roleByName,
      skipUsernames: adminUsername ? [adminUsername] : [],
    });
    console.log(
      `Seeded default test users (${userResults.created.length} created, ${userResults.skipped.length} skipped)`,
    );

    const sapSettings = await upsertSapPrSettings();
    console.log(
      `Seeded SAP PR settings (${sapSettings.updated.length} updated, ${sapSettings.unchanged.length} unchanged)`,
    );

    console.log('Seed completed successfully');
  } finally {
    await disconnectMongo();
  }
}

main().catch((err) => {
  const message = err.cause ? formatMongoConnectionError(err.cause) : err.message;
  console.error('Seed failed:', message);
  process.exit(1);
});
