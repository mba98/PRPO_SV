/**
 * Idempotent backfill: set completionPolicy = ANY_ONE on existing approval matrix rows.
 *
 * Production execution:
 *   1. Ensure MONGODB_URI is set in .env.local (backup recommended).
 *   2. From the project root: npm run migrate:approval-matrix-policy
 *   3. Safe to re-run; only rows missing completionPolicy are updated.
 *
 * Manual MongoDB shell (equivalent):
 *   db.approvalmatrices.updateMany(
 *     { $or: [{ completionPolicy: { $exists: false } }, { completionPolicy: null }] },
 *     { $set: { completionPolicy: "ANY_ONE" } }
 *   )
 */
import mongoose from 'mongoose';
import { loadEnvLocal } from '../lib/loadEnvLocal.js';
import {
  connectMongo,
  disconnectMongo,
  getMongoUriSummary,
} from '../lib/mongodb.js';

const COLLECTION_NAME = 'approvalmatrices';
const COMPLETION_POLICY_ANY_ONE = 'ANY_ONE';

const MISSING_POLICY_FILTER = {
  $or: [{ completionPolicy: { $exists: false } }, { completionPolicy: null }],
};

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

  const beforeCount = await collection.countDocuments(MISSING_POLICY_FILTER);
  console.log(`Rows missing completionPolicy before migration: ${beforeCount}`);

  const result = await collection.updateMany(MISSING_POLICY_FILTER, {
    $set: { completionPolicy: COMPLETION_POLICY_ANY_ONE },
  });

  const matched = result.matchedCount ?? result.n ?? 0;
  const modified = result.modifiedCount ?? result.nModified ?? 0;

  console.log(`Matched rows: ${matched}`);
  console.log(`Modified rows: ${modified}`);

  const afterCount = await collection.countDocuments(MISSING_POLICY_FILTER);
  console.log(`Rows missing completionPolicy after migration: ${afterCount}`);

  if (afterCount > 0) {
    throw new Error(`${afterCount} rows still missing completionPolicy.`);
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
