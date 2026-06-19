/**
 * Idempotent sync: ensure Procurement has apri.create.sap and Finance does not.
 *
 * Production execution:
 *   1. Ensure MONGODB_URI is set in .env.local (backup recommended).
 *   2. From the project root: npm run migrate:apri-sap-permission
 *   3. Safe to re-run.
 */
import mongoose from 'mongoose';
import { loadEnvLocal } from '../lib/loadEnvLocal.js';
import {
  connectMongo,
  disconnectMongo,
  getMongoUriSummary,
} from '../lib/mongodb.js';

const ROLES_COLLECTION = 'roles';
const PERMISSION_KEY = 'apri.create.sap';

async function ensurePermissionOnRole(collection, roleName) {
  const role = await collection.findOne({ name: roleName });
  if (!role) {
    console.log(`${roleName}: role not found — skipped`);
    return;
  }
  const permissions = Array.isArray(role.permissions) ? role.permissions : [];
  if (permissions.includes(PERMISSION_KEY)) {
    console.log(`${roleName}: ${PERMISSION_KEY} already present`);
    return;
  }
  await collection.updateOne({ _id: role._id }, { $addToSet: { permissions: PERMISSION_KEY } });
  console.log(`${roleName}: ${PERMISSION_KEY} added`);
}

async function removePermissionFromRole(collection, roleName) {
  const role = await collection.findOne({ name: roleName });
  if (!role) {
    console.log(`${roleName}: role not found — skipped`);
    return;
  }
  const permissions = Array.isArray(role.permissions) ? role.permissions : [];
  if (!permissions.includes(PERMISSION_KEY)) {
    console.log(`${roleName}: ${PERMISSION_KEY} already absent`);
    return;
  }
  await collection.updateOne({ _id: role._id }, { $pull: { permissions: PERMISSION_KEY } });
  console.log(`${roleName}: ${PERMISSION_KEY} removed`);
}

async function main() {
  loadEnvLocal();

  if (!process.env.MONGODB_URI) {
    throw new Error(
      'MONGODB_URI is not set. Copy .env.local.example to .env.local and configure MongoDB.',
    );
  }

  const { summary } = getMongoUriSummary();
  if (!summary?.ok) {
    throw new Error(`Invalid MONGODB_URI: ${summary?.message || 'unknown error'}`);
  }

  await connectMongo();
  const collection = mongoose.connection.collection(ROLES_COLLECTION);

  await ensurePermissionOnRole(collection, 'Procurement');
  await removePermissionFromRole(collection, 'Finance');

  console.log('Migration completed successfully.');
}

main()
  .catch((error) => {
    console.error('Migration failed:', error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectMongo();
  });
