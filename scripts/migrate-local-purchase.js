/**
 * Idempotent Local Purchase module setup for existing databases.
 *
 * Run: npm run migrate:local-purchase
 */
import mongoose from 'mongoose';
import { loadEnvLocal } from '../lib/loadEnvLocal.js';
import {
  connectMongo,
  disconnectMongo,
  getMongoUriSummary,
} from '../lib/mongodb.js';

const LP_PERMISSIONS = [
  { key: 'lp.create', label: 'Create local purchases', group: 'lp' },
  { key: 'lp.approve.pm', label: 'Approve Local Purchase — project manager', group: 'lp' },
  { key: 'lp.approve.finance', label: 'Approve Local Purchase — finance', group: 'lp' },
  { key: 'lp.view.all', label: 'View all local purchases', group: 'lp' },
  { key: 'lp.cancel', label: 'Cancel local purchases', group: 'lp' },
];

const ROLE_PERMISSIONS = {
  Procurement: ['lp.create'],
  'Project Manager': ['lp.approve.pm'],
  Finance: ['lp.approve.finance'],
  Admin: LP_PERMISSIONS.map((p) => p.key),
};

async function ensureDocumentType(collection) {
  const existing = await collection.findOne({ code: 'LOCAL_PURCHASE' });
  if (existing) {
    console.log('DocumentType LOCAL_PURCHASE: already present');
    return;
  }
  await collection.insertOne({
    code: 'LOCAL_PURCHASE',
    label: 'Local Purchase',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  console.log('DocumentType LOCAL_PURCHASE: created');
}

async function ensurePermissions(collection) {
  for (const perm of LP_PERMISSIONS) {
    const existing = await collection.findOne({ key: perm.key });
    if (existing) {
      console.log(`Permission ${perm.key}: already present`);
      continue;
    }
    await collection.insertOne({
      ...perm,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(`Permission ${perm.key}: created`);
  }
}

async function ensureRolePermissions(rolesCollection) {
  for (const [roleName, permissions] of Object.entries(ROLE_PERMISSIONS)) {
    const role = await rolesCollection.findOne({ name: roleName });
    if (!role) {
      console.log(`${roleName}: role not found — skipped`);
      continue;
    }
    const current = Array.isArray(role.permissions) ? role.permissions : [];
    const missing = permissions.filter((p) => !current.includes(p));
    if (!missing.length) {
      console.log(`${roleName}: all LP permissions already present`);
      continue;
    }
    await rolesCollection.updateOne({ _id: role._id }, { $addToSet: { permissions: { $each: missing } } });
    console.log(`${roleName}: added ${missing.join(', ')}`);
  }
}

async function ensureMatrixSteps(matrixCollection, rolesCollection) {
  const steps = [
    {
      documentType: 'LOCAL_PURCHASE',
      stepOrder: 1,
      stepName: 'Project Manager Approval',
      requiredPermission: 'lp.approve.pm',
      approverRoleName: 'Project Manager',
    },
    {
      documentType: 'LOCAL_PURCHASE',
      stepOrder: 2,
      stepName: 'Finance Approval',
      requiredPermission: 'lp.approve.finance',
      approverRoleName: 'Finance',
    },
  ];

  for (const step of steps) {
    const existing = await matrixCollection.findOne({
      documentType: step.documentType,
      stepOrder: step.stepOrder,
    });
    if (existing) {
      console.log(`Matrix ${step.documentType} step ${step.stepOrder}: already present`);
      continue;
    }
    const role = await rolesCollection.findOne({ name: step.approverRoleName });
    if (!role) {
      console.log(`Matrix step ${step.stepOrder}: role ${step.approverRoleName} not found — skipped`);
      continue;
    }
    await matrixCollection.insertOne({
      documentType: step.documentType,
      stepOrder: step.stepOrder,
      stepName: step.stepName,
      requiredPermission: step.requiredPermission,
      approverRole: role._id,
      completionPolicy: 'ANY_ONE',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(`Matrix ${step.documentType} step ${step.stepOrder}: created`);
  }
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

  await ensureDocumentType(db.collection('documenttypes'));
  await ensurePermissions(db.collection('permissions'));
  await ensureRolePermissions(db.collection('roles'));
  await ensureMatrixSteps(db.collection('approvalmatrices'), db.collection('roles'));

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
