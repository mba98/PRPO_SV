/**
 * Idempotent backfill: map legacy APRI display-string statuses to canonical keys.
 *
 * Production execution:
 *   1. Ensure MONGODB_URI is set in .env.local (backup recommended).
 *   2. From the project root: npm run migrate:apri-status-keys
 *   3. Safe to re-run; only legacy values are rewritten.
 *
 * Generic "Rejected" is migrated only when currentApprovalStep is 0 (warehouse acted).
 */
import mongoose from 'mongoose';
import { loadEnvLocal } from '../lib/loadEnvLocal.js';
import {
  connectMongo,
  disconnectMongo,
  getMongoUriSummary,
} from '../lib/mongodb.js';
import { APRI_STATUS, APRI_STATUS_VALUES } from '../lib/apriStatus.js';

const COLLECTION_NAME = 'apreserveinvoices';

/** Legacy display string → canonical key (safe mappings only). */
const SAFE_LEGACY_MAP = Object.freeze({
  Draft: APRI_STATUS.DRAFT,
  draft: APRI_STATUS.DRAFT,
  'Ready for AP Reserve Invoice': APRI_STATUS.DRAFT,
  'Pending Warehouse Approval': APRI_STATUS.PENDING_WAREHOUSE,
  Approved: APRI_STATUS.WAREHOUSE_APPROVED,
  'Creating in SAP': APRI_STATUS.CREATING_IN_SAP,
  'Created in SAP': APRI_STATUS.CREATED_IN_SAP,
  Completed: APRI_STATUS.CREATED_IN_SAP,
  'Failed to Create in SAP': APRI_STATUS.FAILED_SAP,
  Cancelled: APRI_STATUS.CANCELLED,
});

const REJECTED_LEGACY = 'Rejected';

async function inspectLegacyStatuses(collection) {
  const pipeline = [
    { $group: { _id: '$status', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ];
  return collection.aggregate(pipeline).toArray();
}

async function migrateSafeLegacy(collection) {
  let modified = 0;
  for (const [legacy, canonical] of Object.entries(SAFE_LEGACY_MAP)) {
    const result = await collection.updateMany({ status: legacy }, { $set: { status: canonical } });
    modified += result.modifiedCount ?? result.nModified ?? 0;
  }
  return modified;
}

async function migrateWarehouseRejected(collection) {
  const result = await collection.updateMany(
    {
      status: REJECTED_LEGACY,
      currentApprovalStep: 0,
    },
    { $set: { status: APRI_STATUS.WAREHOUSE_REJECTED } },
  );
  return result.modifiedCount ?? result.nModified ?? 0;
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
  const collection = mongoose.connection.collection(COLLECTION_NAME);

  console.log('APRI status distribution before migration:');
  const before = await inspectLegacyStatuses(collection);
  for (const row of before) {
    console.log(`  ${JSON.stringify(row._id)}: ${row.count}`);
  }

  const safeModified = await migrateSafeLegacy(collection);
  const rejectedModified = await migrateWarehouseRejected(collection);
  console.log(`Safe legacy mappings updated: ${safeModified}`);
  console.log(`Warehouse Rejected mappings updated: ${rejectedModified}`);

  const after = await inspectLegacyStatuses(collection);
  console.log('APRI status distribution after migration:');
  for (const row of after) {
    console.log(`  ${JSON.stringify(row._id)}: ${row.count}`);
  }

  const nonCanonical = after.filter(
    (row) => row._id != null && !APRI_STATUS_VALUES.includes(row._id) && row._id !== REJECTED_LEGACY,
  );
  if (nonCanonical.length) {
    console.warn('Non-canonical statuses remain (review manually):');
    for (const row of nonCanonical) {
      console.warn(`  ${JSON.stringify(row._id)}: ${row.count}`);
    }
  }

  const ambiguousRejected = after.find((row) => row._id === REJECTED_LEGACY);
  if (ambiguousRejected?.count) {
    console.warn(
      `${ambiguousRejected.count} record(s) still use generic "Rejected" — review before migrating.`,
    );
  }

  console.log('Migration completed.');
}

main()
  .catch((error) => {
    console.error('Migration failed:', error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectMongo();
  });
