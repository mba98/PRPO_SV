/**
 * Read-only approval matrix preflight — compares active vs legacy collections.
 *
 * Run: npm run preflight:approval-matrix
 */
import mongoose from 'mongoose';
import { loadEnvLocal } from '../lib/loadEnvLocal.js';
import {
  connectMongo,
  disconnectMongo,
  getMongoUriSummary,
} from '../lib/mongodb.js';
import { formatMongoConnectionError } from '../lib/mongodbUri.js';
import ApprovalMatrix from '../models/ApprovalMatrix.js';
import '../models/Role.js';

const REQUIRED_WORKFLOWS = ['PR', 'PO', 'APRI', 'LOCAL_PURCHASE'];
const ACTIVE_COLLECTION = ApprovalMatrix.collection.name;
const LEGACY_COLLECTIONS = ['approvalmatrices', 'approvalmatricesaudit'];

function summarizeStep(row, roleNameById) {
  const roleId = row.approverRole?.toString?.() || String(row.approverRole || '');
  return {
    stepOrder: row.stepOrder,
    stepName: row.stepName,
    requiredPermission: row.requiredPermission,
    approverRole:
      row.approverRole?.name ||
      roleNameById.get(roleId) ||
      roleId ||
      '(unknown)',
    isActive: row.isActive !== false,
    completionPolicy: row.completionPolicy || 'ANY_ONE',
  };
}

async function loadRoleMap(db) {
  const roles = await db.collection('roles').find({}).project({ name: 1 }).toArray();
  return new Map(roles.map((r) => [r._id.toString(), r.name]));
}

async function summarizeCollection(db, collectionName, roleNameById) {
  const exists = (await db.listCollections({ name: collectionName }).toArray()).length > 0;
  if (!exists) {
    return { collectionName, exists: false, count: 0, byType: {} };
  }

  const rows = await db
    .collection(collectionName)
    .find({})
    .sort({ documentType: 1, stepOrder: 1 })
    .toArray();

  const byType = {};
  for (const row of rows) {
    const docType = String(row.documentType || '').toUpperCase();
    if (!byType[docType]) byType[docType] = [];
    byType[docType].push(summarizeStep(row, roleNameById));
  }

  return { collectionName, exists: true, count: rows.length, byType };
}

async function summarizeViaMongoose(roleNameById) {
  const rows = await ApprovalMatrix.find({})
    .sort({ documentType: 1, stepOrder: 1 })
    .populate('approverRole', 'name')
    .lean();

  const byType = {};
  for (const row of rows) {
    const docType = String(row.documentType || '').toUpperCase();
    if (!byType[docType]) byType[docType] = [];
    byType[docType].push(summarizeStep(row, roleNameById));
  }

  return {
    model: 'ApprovalMatrix',
    collection: ACTIVE_COLLECTION,
    count: rows.length,
    byType,
  };
}

function printWorkflowCoverage(label, summary) {
  console.log(`\n=== ${label} (${summary.collectionName || summary.collection}) ===`);
  console.log(`Documents: ${summary.count}`);
  if (!summary.exists && summary.count === 0 && !summary.byType) {
    console.log('Collection not found.');
    return { missing: [...REQUIRED_WORKFLOWS], present: [] };
  }

  const present = [];
  const missing = [];
  for (const docType of REQUIRED_WORKFLOWS) {
    const steps = summary.byType?.[docType] || [];
    if (steps.length) {
      present.push(docType);
      console.log(`\n[${docType}] ${steps.length} step(s)`);
      for (const step of steps) {
        console.log(
          `  ${step.stepOrder}. ${step.stepName} | permission=${step.requiredPermission} | role=${step.approverRole} | active=${step.isActive} | policy=${step.completionPolicy}`,
        );
      }
    } else {
      missing.push(docType);
    }
  }

  if (missing.length) {
    console.log(`\nMissing workflows: ${missing.join(', ')}`);
  } else {
    console.log('\nAll required workflows present.');
  }

  return { missing, present };
}

async function main() {
  loadEnvLocal();
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not set.');
  }

  const { summary: uriSummary } = getMongoUriSummary();
  await connectMongo();
  const db = mongoose.connection.db;
  const roleNameById = await loadRoleMap(db);

  console.log('=== Approval Matrix Preflight (read-only) ===');
  console.log(`Database: ${db.databaseName}`);
  if (uriSummary?.ok) {
    console.log(`Hosts: ${uriSummary.hosts}`);
  }

  console.log('\n--- Code references ---');
  console.log(`Mongoose model: ApprovalMatrix`);
  console.log(`Resolved collection name: ${ACTIVE_COLLECTION}`);
  console.log('Runtime queries: ApprovalMatrix.find(...) in approvalEngine.js, approvalMatrixService.js');
  console.log(
    'Note: Mongoose pluralizes ApprovalMatrix → approvalmatrixes (not approvalmatrices).',
  );
  console.log('Orphan/stale collection approvalmatrices may exist from manual migrations.');

  const mongooseSummary = await summarizeViaMongoose(roleNameById);
  const activeCoverage = printWorkflowCoverage('ACTIVE (Mongoose / runtime)', {
    collectionName: mongooseSummary.collection,
    exists: true,
    count: mongooseSummary.count,
    byType: mongooseSummary.byType,
  });

  for (const legacyName of LEGACY_COLLECTIONS) {
    const legacySummary = await summarizeCollection(db, legacyName, roleNameById);
    if (legacySummary.exists && legacySummary.count > 0) {
      printWorkflowCoverage(`LEGACY (${legacyName})`, legacySummary);
    }
  }

  console.log('\n=== Conclusion ===');
  console.log(`The application reads workflow steps from: ${ACTIVE_COLLECTION}`);
  if (activeCoverage.missing.length) {
    console.log(
      `WARNING: Active collection is missing workflow(s): ${activeCoverage.missing.join(', ')}`,
    );
    console.log(
      'Review legacy collection approvalmatrixes — a safe migration may be needed before Live.',
    );
    console.log(
      'Suggested migration: copy missing documentType rows from approvalmatrixes into approvalmatrices (idempotent upsert by documentType+stepOrder), then verify in UI.',
    );
  } else {
    console.log('Active collection contains all required workflows.');
  }
}

main()
  .catch((error) => {
    console.error('Preflight failed:', formatMongoConnectionError(error.cause || error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectMongo();
  });
