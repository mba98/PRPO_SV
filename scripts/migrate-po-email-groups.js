/**
 * Idempotent PO email-group migration for 3-step approval notifications.
 *
 * Run: npm run migrate:po-email-groups
 *
 * - po.pm.approved: legacy Finance-only role recipient → Operation Manager
 * - po.om.approved: create or ensure Finance role recipient
 *
 * Custom po.pm.approved groups (direct emails, users, mixed roles, non-legacy) are left unchanged.
 */
import mongoose from 'mongoose';
import { loadEnvLocal } from '../lib/loadEnvLocal.js';
import {
  connectMongo,
  disconnectMongo,
  getMongoUriSummary,
} from '../lib/mongodb.js';

function roleIdEquals(a, b) {
  if (!a || !b) return false;
  return a.toString() === b.toString();
}

/**
 * Legacy seed mapped po.pm.approved to a single Finance role recipient only.
 */
function isLegacyFinanceOnlyPmApprovedGroup(group, financeRoleId) {
  const recipients = group?.recipients || [];
  if (recipients.length !== 1) return false;
  const recipient = recipients[0];
  if (recipient.email || recipient.userId) return false;
  if (!recipient.role) return false;
  return roleIdEquals(recipient.role, financeRoleId);
}

function hasAnyRecipients(group) {
  return (group?.recipients || []).length > 0;
}

async function migratePmApprovedGroup(collection, rolesByName) {
  const financeRole = rolesByName.Finance;
  const omRole = rolesByName['Operation Manager'];
  if (!omRole) {
    console.log('Operation Manager role not found — po.pm.approved migration skipped');
    return;
  }

  const existing = await collection.findOne({ eventKey: 'po.pm.approved' });
  if (!existing) {
    await collection.insertOne({
      eventKey: 'po.pm.approved',
      recipients: [{ role: omRole._id }],
      ccRoles: [],
      isActive: true,
      updatedAt: new Date(),
    });
    console.log('po.pm.approved: created with Operation Manager role');
    return;
  }

  if (!financeRole || !isLegacyFinanceOnlyPmApprovedGroup(existing, financeRole._id)) {
    console.log(
      'po.pm.approved: custom or non-legacy configuration detected — left unchanged',
    );
    return;
  }

  await collection.updateOne(
    { _id: existing._id },
    {
      $set: {
        recipients: [{ role: omRole._id }],
        updatedAt: new Date(),
      },
    },
  );
  console.log('po.pm.approved: migrated Finance-only recipient to Operation Manager');
}

async function ensureOmApprovedGroup(collection, rolesByName) {
  const financeRole = rolesByName.Finance;
  if (!financeRole) {
    console.log('Finance role not found — po.om.approved migration skipped');
    return;
  }

  const existing = await collection.findOne({ eventKey: 'po.om.approved' });
  if (!existing) {
    await collection.insertOne({
      eventKey: 'po.om.approved',
      recipients: [{ role: financeRole._id }],
      ccRoles: [],
      isActive: true,
      updatedAt: new Date(),
    });
    console.log('po.om.approved: created with Finance role');
    return;
  }

  if (hasAnyRecipients(existing)) {
    console.log('po.om.approved: already configured — left unchanged');
    return;
  }

  await collection.updateOne(
    { _id: existing._id },
    {
      $set: {
        recipients: [{ role: financeRole._id }],
        isActive: existing.isActive !== false,
        updatedAt: new Date(),
      },
    },
  );
  console.log('po.om.approved: populated empty group with Finance role');
}

async function main() {
  loadEnvLocal();

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not set.');
  }

  const { summary } = getMongoUriSummary();
  if (!summary?.ok) {
    throw new Error(`Invalid MONGODB_URI: ${summary?.message || 'unknown error'}`);
  }

  await connectMongo();
  const db = mongoose.connection.db;
  const rolesCollection = db.collection('roles');
  const emailGroupsCollection = db.collection('emailgroups');

  const roleNames = ['Finance', 'Operation Manager'];
  const roles = await rolesCollection.find({ name: { $in: roleNames } }).toArray();
  const rolesByName = Object.fromEntries(roles.map((role) => [role.name, role]));

  await migratePmApprovedGroup(emailGroupsCollection, rolesByName);
  await ensureOmApprovedGroup(emailGroupsCollection, rolesByName);

  console.log('PO email group migration completed successfully.');
}

main()
  .catch((error) => {
    console.error('Migration failed:', error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectMongo();
  });
