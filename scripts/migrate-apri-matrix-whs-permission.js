/**
 * Idempotent fix: APRI warehouse matrix step must use apri.approve.whs (not pr.approve.whs).
 *
 * Production execution:
 *   1. Ensure MONGODB_URI is set in .env.local (backup recommended).
 *   2. From the project root: npm run migrate:apri-matrix-whs-permission
 *   3. Safe to re-run; only APRI rows still on pr.approve.whs are updated.
 *
 * Targets both approvalmatrixes (Mongoose runtime) and approvalmatrices (legacy orphan rows).
 */
import mongoose from 'mongoose';
import { loadEnvLocal } from '../lib/loadEnvLocal.js';
import {
  connectMongo,
  disconnectMongo,
  getMongoUriSummary,
} from '../lib/mongodb.js';

const TARGET_PERMISSION = 'apri.approve.whs';
const LEGACY_PERMISSION = 'pr.approve.whs';
/** Mongoose pluralizes ApprovalMatrix → approvalmatrixes (runtime collection). */
const RUNTIME_MATRIX_COLLECTION = 'approvalmatrixes';
const LEGACY_MATRIX_COLLECTION = 'approvalmatrices';

const APRI_LEGACY_FILTER = {
  documentType: 'APRI',
  requiredPermission: LEGACY_PERMISSION,
};

function uniqueCollectionNames(names) {
  return [...new Set(names.filter(Boolean))];
}

async function migrateCollection(collection) {
  const collectionName = collection.collectionName;
  const beforeCount = await collection.countDocuments(APRI_LEGACY_FILTER);
  console.log(`${collectionName}: APRI rows on ${LEGACY_PERMISSION} before migration: ${beforeCount}`);

  if (beforeCount === 0) {
    console.log(`${collectionName}: nothing to update`);
    return { collectionName, matched: 0, modified: 0, remaining: 0 };
  }

  const result = await collection.updateMany(APRI_LEGACY_FILTER, {
    $set: { requiredPermission: TARGET_PERMISSION },
  });

  const matched = result.matchedCount ?? result.n ?? 0;
  const modified = result.modifiedCount ?? result.nModified ?? 0;
  const remaining = await collection.countDocuments(APRI_LEGACY_FILTER);

  console.log(`${collectionName}: matched=${matched}, modified=${modified}, remaining=${remaining}`);

  if (remaining > 0) {
    throw new Error(
      `${collectionName}: ${remaining} APRI row(s) still use ${LEGACY_PERMISSION} after migration.`,
    );
  }

  return { collectionName, matched, modified, remaining };
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

  const collectionNames = uniqueCollectionNames([
    RUNTIME_MATRIX_COLLECTION,
    LEGACY_MATRIX_COLLECTION,
  ]);

  for (const name of collectionNames) {
    const collection = mongoose.connection.collection(name);
    await migrateCollection(collection);
  }

  const prLegacyOnApriPermission = await mongoose.connection
    .collection(RUNTIME_MATRIX_COLLECTION)
    .countDocuments({ documentType: 'PR', requiredPermission: TARGET_PERMISSION });
  if (prLegacyOnApriPermission > 0) {
    throw new Error(
      `Unexpected PR matrix row(s) using ${TARGET_PERMISSION}; PR workflow must stay on pr.approve.whs.`,
    );
  }

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
