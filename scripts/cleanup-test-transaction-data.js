/**
 * Safe cleanup of test transactional data before Test → Live cutover.
 *
 * Dry-run (default):
 *   npm run cleanup:test-data
 *
 * Execute (destructive):
 *   npm run cleanup:test-data -- --execute --confirm-database=DATABASE_NAME \
 *     --confirm-mongodump-path=./backup/prpo_sv-YYYYMMDD/prpo_sv \
 *     --confirm-sap-export-path=./backup/prpo_sv-YYYYMMDD
 *
 * Optional counter reset (NOT default):
 *   add --reset-counters
 *   WARNING: Resetting counters may reuse portal document numbers already referenced in SAP.
 *
 * Production requires: --allow-production
 */
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { loadEnvLocal } from '../lib/loadEnvLocal.js';
import {
  connectMongo,
  disconnectMongo,
  getMongoUriSummary,
} from '../lib/mongodb.js';
import { formatMongoConnectionError } from '../lib/mongodbUri.js';

const DOCUMENT_TYPES = ['PR', 'PO', 'APRI', 'LOCAL_PURCHASE'];

const DELETE_COLLECTIONS = [
  'apreserveinvoices',
  'purchaseorders',
  'purchaserequests',
  'localpurchases',
];

const DEPENDENT_COLLECTIONS = [
  { name: 'comments', filter: { documentType: { $in: DOCUMENT_TYPES } } },
  { name: 'approvalhistories', filter: { documentType: { $in: DOCUMENT_TYPES } } },
  { name: 'attachments', filter: { documentType: { $in: DOCUMENT_TYPES } } },
  { name: 'emaillogs', filter: { relatedDocumentType: { $in: DOCUMENT_TYPES } } },
  { name: 'sapintegrationlogs', filter: { documentType: { $in: DOCUMENT_TYPES } } },
];

const PRESERVE_COLLECTIONS = [
  'users',
  'roles',
  'permissions',
  'approvalmatrices',
  'approvalmatrixes',
  'approvalmatrixaudits',
  'emailgroups',
  'systemsettings',
  'documenttypes',
];

const OPTIONAL_PRESERVE_COLLECTIONS = ['itemcreationlogs'];
const LEGACY_PRESERVE_COLLECTIONS = ['approvalmatricesaudit'];

const COUNTER_KEY_PATTERN = /^(pr|po|apri|lp)_seq_\d{8}$/i;
const COUNTER_RESET_WARNING =
  'WARNING: Resetting counters may reuse portal document numbers already referenced in SAP.';

const DELETE_ORDER = [
  ...DEPENDENT_COLLECTIONS.map((c) => c.name),
  ...DELETE_COLLECTIONS,
];

function parseArgValue(argv, prefix) {
  const match = argv.find((a) => a.startsWith(prefix));
  if (!match) return null;
  return match.slice(prefix.length).trim() || null;
}

function parseArgs(argv) {
  return {
    execute: argv.includes('--execute'),
    allowProduction: argv.includes('--allow-production'),
    resetCounters: argv.includes('--reset-counters'),
    confirmDatabase: parseArgValue(argv, '--confirm-database='),
    confirmMongodumpPath: parseArgValue(argv, '--confirm-mongodump-path='),
    confirmSapExportPath: parseArgValue(argv, '--confirm-sap-export-path='),
  };
}

function extractDatabaseNameFromUri(uri) {
  if (!uri) return null;
  const withoutQuery = uri.trim().split('?')[0];
  const slash = withoutQuery.lastIndexOf('/');
  if (slash === -1) return null;
  return withoutQuery.slice(slash + 1) || null;
}

function isProductionEnvironment(dbName) {
  if (process.env.NODE_ENV === 'production') return true;
  const lower = String(dbName || '').toLowerCase();
  if (lower.includes('prod') && !lower.includes('test')) return true;
  if (lower.includes('live') && !lower.includes('test')) return true;
  return false;
}

function resolveExistingPath(inputPath) {
  const resolved = path.resolve(process.cwd(), inputPath);
  if (!fs.existsSync(resolved)) return null;
  return resolved;
}

function verifyMongodumpPath(inputPath, dbName) {
  const resolved = resolveExistingPath(inputPath);
  if (!resolved) {
    return { ok: false, message: `mongodump path not found: ${inputPath}` };
  }

  const candidates = [resolved, path.join(resolved, dbName)];
  for (const dir of candidates) {
    if (!fs.existsSync(dir)) continue;
    const entries = fs.readdirSync(dir);
    const hasBson = entries.some((name) => name.endsWith('.bson') || name.endsWith('.metadata.json'));
    if (hasBson) {
      return { ok: true, path: dir, message: `Verified mongodump at ${dir}` };
    }
  }

  return {
    ok: false,
    message: `No .bson/.metadata.json files found under ${inputPath} or ${inputPath}/${dbName}`,
  };
}

function verifySapExportPath(inputPath) {
  const resolved = resolveExistingPath(inputPath);
  if (!resolved) {
    return { ok: false, message: `SAP export path not found: ${inputPath}` };
  }

  const jsonPath = fs.statSync(resolved).isDirectory()
    ? path.join(resolved, 'sap-references.json')
    : resolved;

  if (!fs.existsSync(jsonPath)) {
    return { ok: false, message: `Missing sap-references.json at ${jsonPath}` };
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    if (!Array.isArray(parsed.rows)) {
      return { ok: false, message: 'sap-references.json is missing a rows array' };
    }
    return {
      ok: true,
      path: jsonPath,
      message: `Verified SAP export (${parsed.rows.length} rows) at ${jsonPath}`,
    };
  } catch (err) {
    return { ok: false, message: `Invalid sap-references.json: ${err.message}` };
  }
}

async function checkTransactionSupport(db) {
  try {
    const hello = await db.admin().command({ hello: 1 });
    const replicaSet = Boolean(hello.setName);
    if (!replicaSet) {
      return {
        supported: false,
        reason: 'Server is not a replica set — multi-document transactions unavailable.',
      };
    }

    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      await db.collection('purchaserequests').countDocuments({}, { session });
      await session.abortTransaction();
      return {
        supported: true,
        reason: `Replica set "${hello.setName}" — transactions supported.`,
      };
    } finally {
      await session.endSession();
    }
  } catch (err) {
    return { supported: false, reason: err.message || 'Transaction probe failed.' };
  }
}

async function countDocuments(collection, filter = {}) {
  return collection.countDocuments(filter);
}

async function findCounterSettings(db) {
  const settings = await db
    .collection('systemsettings')
    .find({ key: { $regex: COUNTER_KEY_PATTERN } })
    .project({ key: 1, seq: 1, value: 1, type: 1 })
    .toArray();
  return settings.sort((a, b) => String(a.key).localeCompare(String(b.key)));
}

async function countSapLinkedDocuments(db) {
  const prSap = await db.collection('purchaserequests').countDocuments({
    $or: [{ sapPRDocEntry: { $exists: true, $ne: null } }, { sapPRDocNum: { $exists: true, $ne: null } }],
  });
  const poSap = await db.collection('purchaseorders').countDocuments({
    $or: [{ sapPODocEntry: { $exists: true, $ne: null } }, { sapPODocNum: { $exists: true, $ne: null } }],
  });
  const apriSap = await db.collection('apreserveinvoices').countDocuments({
    $or: [{ sapAPDocEntry: { $exists: true, $ne: null } }, { sapAPDocNum: { $exists: true, $ne: null } }],
  });
  return { prSap, poSap, apriSap };
}

async function countRelationships(db) {
  const prCount = await db.collection('purchaserequests').countDocuments();
  const poCount = await db.collection('purchaseorders').countDocuments();
  const apriCount = await db.collection('apreserveinvoices').countDocuments();
  const lpCount = await db.collection('localpurchases').countDocuments();
  const poWithPr = await db.collection('purchaseorders').countDocuments({
    relatedPRId: { $exists: true, $ne: null },
  });
  const apriWithPo = await db.collection('apreserveinvoices').countDocuments({
    relatedPOId: { $exists: true, $ne: null },
  });
  return { prCount, poCount, apriCount, lpCount, poWithPr, apriWithPo };
}

async function buildInventory(db) {
  const existing = await db.listCollections().toArray();
  const collectionNames = existing.map((c) => c.name).sort();
  const known = new Set([
    ...DELETE_COLLECTIONS,
    ...DEPENDENT_COLLECTIONS.map((c) => c.name),
    ...PRESERVE_COLLECTIONS,
    ...LEGACY_PRESERVE_COLLECTIONS,
    ...OPTIONAL_PRESERVE_COLLECTIONS,
  ]);
  const unexpected = collectionNames.filter((name) => !known.has(name));

  const counts = {};
  for (const name of collectionNames) {
    counts[name] = await db.collection(name).countDocuments();
  }

  const dependentPlanned = {};
  for (const entry of DEPENDENT_COLLECTIONS) {
    dependentPlanned[entry.name] = await countDocuments(db.collection(entry.name), entry.filter);
  }

  const deletePlanned = {};
  for (const name of DELETE_COLLECTIONS) {
    deletePlanned[name] = counts[name] ?? 0;
  }

  return {
    collectionNames,
    counts,
    unexpected,
    dependentPlanned,
    deletePlanned,
    counters: await findCounterSettings(db),
    relationships: await countRelationships(db),
    sapLinked: await countSapLinkedDocuments(db),
    itemCreationCount: counts.itemcreationlogs ?? 0,
  };
}

function printInventoryReport({
  dbName,
  uriSummary,
  inventory,
  mode,
  resetCounters,
  transactionSupport,
}) {
  console.log('\n=== Test → Live cleanup report ===');
  console.log(`Mode: ${mode}`);
  console.log(`Database: ${dbName}`);
  if (uriSummary?.ok) {
    console.log(`MongoDB hosts: ${uriSummary.hosts}`);
    console.log(`Scheme: ${uriSummary.scheme}`);
  }

  console.log('\n--- Transaction support ---');
  console.log(`  Supported: ${transactionSupport.supported ? 'yes' : 'no'}`);
  console.log(`  Detail: ${transactionSupport.reason}`);
  if (!transactionSupport.supported) {
    console.log('  Rollback plan if execute is used without transactions: restore from mongodump backup.');
  }

  console.log('\n--- All collections (actual) ---');
  for (const name of inventory.collectionNames) {
    console.log(`  ${name}: ${inventory.counts[name]}`);
  }

  console.log('\n--- Planned deletion (dependent, filtered) ---');
  for (const [name, count] of Object.entries(inventory.dependentPlanned)) {
    console.log(`  ${name}: ${inventory.counts[name] ?? 0} total → ${count} planned`);
  }

  console.log('\n--- Planned deletion (transactional documents) ---');
  for (const [name, count] of Object.entries(inventory.deletePlanned)) {
    console.log(`  ${name}: ${inventory.counts[name] ?? 0} before → ${count} planned`);
  }

  const totalDelete =
    Object.values(inventory.dependentPlanned).reduce((a, b) => a + b, 0) +
    Object.values(inventory.deletePlanned).reduce((a, b) => a + b, 0);
  console.log(`\n  TOTAL planned deletions: ${totalDelete}`);

  console.log('\n--- Counters ---');
  if (!resetCounters) {
    console.log('  Counter reset: DISABLED (default)');
    console.log(`  ${inventory.counters.length} counter row(s) in systemsettings will be PRESERVED.`);
    console.log('  Use --reset-counters only if you intentionally want numbering to restart.');
  } else {
    console.log(`  Counter reset: ENABLED — ${COUNTER_RESET_WARNING}`);
    for (const row of inventory.counters) {
      const seq = row.seq ?? row.value?.seq ?? 0;
      console.log(`    ${row.key}: current seq=${seq} → delete counter row`);
    }
  }

  console.log('\n--- Deletion order ---');
  console.log(`  ${DELETE_ORDER.join(' → ')}`);
}

async function deleteCounterRows(db, session) {
  const counters = await findCounterSettings(db);
  if (!counters.length) return { deleted: 0 };
  const keys = counters.map((c) => c.key);
  const result = await db.collection('systemsettings').deleteMany(
    { key: { $in: keys } },
    session ? { session } : undefined,
  );
  return { deleted: result.deletedCount };
}

async function executeCleanup(db, { resetCounters, useTransaction }) {
  const before = {};
  for (const name of DELETE_ORDER) {
    before[name] = await db.collection(name).countDocuments();
  }

  const runDeletes = async (session) => {
    const opts = session ? { session } : undefined;
    for (const entry of DEPENDENT_COLLECTIONS) {
      const result = await db.collection(entry.name).deleteMany(entry.filter, opts);
      console.log(`Deleted ${result.deletedCount} from ${entry.name} (filtered)`);
    }
    for (const name of DELETE_COLLECTIONS) {
      const result = await db.collection(name).deleteMany({}, opts);
      console.log(`Deleted ${result.deletedCount} from ${name}`);
    }
    if (resetCounters) {
      const counterResult = await deleteCounterRows(db, session);
      console.log(`Reset ${counterResult.deleted} document counter row(s) in systemsettings`);
      console.log(COUNTER_RESET_WARNING);
    } else {
      console.log('Counters preserved (no --reset-counters flag).');
    }
  };

  if (useTransaction) {
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      await runDeletes(session);
      await session.commitTransaction();
      console.log('Cleanup committed inside a single MongoDB transaction.');
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      await session.endSession();
    }
  } else {
    await runDeletes(null);
    console.log('Cleanup executed without transaction (not supported by deployment).');
    console.log('Rollback requires mongodump restore if anything goes wrong.');
  }

  const after = {};
  for (const name of DELETE_ORDER) {
    after[name] = await db.collection(name).countDocuments();
  }
  return { before, after };
}

function printExecuteRequirements() {
  console.log('\n=== Execute requirements ===');
  console.log('  --execute');
  console.log('  --confirm-database=DATABASE_NAME');
  console.log('  --confirm-mongodump-path=PATH_TO_DUMP_OR_DB_FOLDER');
  console.log('  --confirm-sap-export-path=PATH_TO_BACKUP_FOLDER_OR_JSON');
  console.log('Optional: --reset-counters');
  console.log('Optional (production-like DB): --allow-production');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const mode = args.execute ? 'EXECUTE' : 'DRY-RUN';

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
  const dbName = db.databaseName;
  const transactionSupport = await checkTransactionSupport(db);
  const inventory = await buildInventory(db);

  printInventoryReport({
    dbName,
    uriSummary: summary,
    inventory,
    mode,
    resetCounters: args.resetCounters,
    transactionSupport,
  });

  if (inventory.unexpected.some((name) => inventory.counts[name] > 0)) {
    console.error('\nABORT: Unexpected non-empty collection(s) detected.');
    process.exitCode = 1;
    return;
  }

  if (!args.execute) {
    console.log('\n=== DRY-RUN complete — no data modified ===');
    printExecuteRequirements();
    return;
  }

  if (!args.confirmDatabase) {
    console.error('\nABORT: --execute requires --confirm-database=DATABASE_NAME');
    process.exitCode = 1;
    return;
  }
  if (args.confirmDatabase !== dbName) {
    console.error(`\nABORT: --confirm-database="${args.confirmDatabase}" != connected "${dbName}".`);
    process.exitCode = 1;
    return;
  }
  if (isProductionEnvironment(dbName) && !args.allowProduction) {
    console.error('\nABORT: Production-like database. Use --allow-production if intentional.');
    process.exitCode = 1;
    return;
  }
  if (!args.confirmMongodumpPath) {
    console.error('\nABORT: --execute requires --confirm-mongodump-path=...');
    process.exitCode = 1;
    return;
  }
  if (!args.confirmSapExportPath) {
    console.error('\nABORT: --execute requires --confirm-sap-export-path=...');
    process.exitCode = 1;
    return;
  }

  const dumpCheck = verifyMongodumpPath(args.confirmMongodumpPath, dbName);
  if (!dumpCheck.ok) {
    console.error(`\nABORT: ${dumpCheck.message}`);
    process.exitCode = 1;
    return;
  }
  console.log(`\n${dumpCheck.message}`);

  const sapCheck = verifySapExportPath(args.confirmSapExportPath);
  if (!sapCheck.ok) {
    console.error(`\nABORT: ${sapCheck.message}`);
    process.exitCode = 1;
    return;
  }
  console.log(sapCheck.message);

  if (!transactionSupport.supported) {
    console.error('\nABORT: Transactions not supported — execute blocked for safety.');
    console.error('Use mongodump for rollback, or migrate to a replica-set deployment first.');
    process.exitCode = 1;
    return;
  }

  console.log('\n=== EXECUTING cleanup ===');
  const { before, after } = await executeCleanup(db, {
    resetCounters: args.resetCounters,
    useTransaction: true,
  });

  console.log('\n--- Counts before → after ---');
  for (const name of DELETE_ORDER) {
    console.log(`  ${name}: ${before[name]} → ${after[name]}`);
  }
  console.log('\nCleanup completed.');
}

main()
  .catch((error) => {
    console.error('Cleanup failed:', formatMongoConnectionError(error.cause || error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectMongo();
  });
