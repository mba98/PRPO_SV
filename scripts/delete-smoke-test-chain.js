/**
 * Export and delete a single PR → PO → APRI smoke-test chain inside one transaction.
 *
 * Usage:
 *   node scripts/delete-smoke-test-chain.js            # inspect + export only
 *   node scripts/delete-smoke-test-chain.js --execute  # export then delete
 */
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { loadEnvLocal } from '../lib/loadEnvLocal.js';
import { connectMongo, disconnectMongo } from '../lib/mongodb.js';

const PR_ID = '6a54c41e3a1606dad42f248b';
const PO_ID = '6a54c45e3a1606dad42f24ee';
const APRI_ID = '6a54c8853a1606dad42f261d';

function oid(id) {
  return new mongoose.Types.ObjectId(id);
}

const DOCUMENT_TYPES = ['PR', 'PO', 'APRI'];
const DOCUMENT_ID_STRINGS = [PR_ID, PO_ID, APRI_ID];
const DOCUMENT_OBJECT_IDS = DOCUMENT_ID_STRINGS.map((id) => oid(id));

function buildDependentCollections() {
  const docIdFilter = { $in: DOCUMENT_OBJECT_IDS };
  return [
    {
      name: 'approvalhistories',
      filter: { documentType: { $in: DOCUMENT_TYPES }, documentId: docIdFilter },
    },
    {
      name: 'comments',
      filter: { documentType: { $in: DOCUMENT_TYPES }, documentId: docIdFilter },
    },
    {
      name: 'attachments',
      filter: { documentType: { $in: DOCUMENT_TYPES }, documentId: docIdFilter },
    },
    {
      name: 'emaillogs',
      filter: {
        relatedDocumentType: { $in: DOCUMENT_TYPES },
        relatedDocumentId: docIdFilter,
      },
    },
    {
      name: 'sapintegrationlogs',
      filter: { documentType: { $in: DOCUMENT_TYPES }, documentId: docIdFilter },
    },
  ];
}

const DELETE_DOCS = [
  { collection: 'apreserveinvoices', id: APRI_ID },
  { collection: 'purchaseorders', id: PO_ID },
  { collection: 'purchaserequests', id: PR_ID },
];

function loadDotEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

function portalNumber(doc, type) {
  if (type === 'PR') return doc?.portalPRNumber ?? null;
  if (type === 'PO') return doc?.portalPONumber ?? null;
  return doc?.portalAPNumber ?? doc?.portalAPRINumber ?? null;
}

function sapRefs(doc, type) {
  if (type === 'PR') {
    return { docEntry: doc?.sapPRDocEntry ?? null, docNum: doc?.sapPRDocNum ?? null };
  }
  if (type === 'PO') {
    return { docEntry: doc?.sapPODocEntry ?? null, docNum: doc?.sapPODocNum ?? null };
  }
  return { docEntry: doc?.sapAPDocEntry ?? null, docNum: doc?.sapAPDocNum ?? null };
}

function summarizeChain(pr, po, apri) {
  return {
    pr: {
      portalNumber: portalNumber(pr, 'PR'),
      _id: String(pr._id),
      status: pr.status,
      sap: sapRefs(pr, 'PR'),
      relatedPOId: pr.relatedPOId ? String(pr.relatedPOId) : null,
    },
    po: {
      portalNumber: portalNumber(po, 'PO'),
      _id: String(po._id),
      status: po.status,
      sap: sapRefs(po, 'PO'),
      relatedPRId: po.relatedPRId ? String(po.relatedPRId) : null,
      relatedAPRIId: null,
    },
    apri: {
      portalNumber: portalNumber(apri, 'APRI'),
      _id: String(apri._id),
      status: apri.status,
      sap: sapRefs(apri, 'APRI'),
      relatedPOId: apri.relatedPOId ? String(apri.relatedPOId) : null,
    },
  };
}

async function loadChain(db) {
  const pr = await db.collection('purchaserequests').findOne({ _id: oid(PR_ID) });
  const po = await db.collection('purchaseorders').findOne({ _id: oid(PO_ID) });
  const apri = await db.collection('apreserveinvoices').findOne({ _id: oid(APRI_ID) });
  return { pr, po, apri };
}

function assertChainIntegrity({ pr, po, apri }) {
  if (!pr) throw new Error(`PR not found: ${PR_ID}`);
  if (!po) throw new Error(`PO not found: ${PO_ID}`);
  if (!apri) throw new Error(`APRI not found: ${APRI_ID}`);
  if (String(po.relatedPRId) !== PR_ID) {
    throw new Error(`PO.relatedPRId mismatch: expected ${PR_ID}, got ${po.relatedPRId}`);
  }
  if (String(apri.relatedPOId) !== PO_ID) {
    throw new Error(`APRI.relatedPOId mismatch: expected ${PO_ID}, got ${apri.relatedPOId}`);
  }
}

async function countDependents(db) {
  const counts = {};
  for (const entry of buildDependentCollections()) {
    counts[entry.name] = await db.collection(entry.name).countDocuments(entry.filter);
  }
  return counts;
}

async function exportChain(db, outPath) {
  const { pr, po, apri } = await loadChain(db);
  assertChainIntegrity({ pr, po, apri });

  const dependents = {};
  for (const entry of buildDependentCollections()) {
    dependents[entry.name] = await db.collection(entry.name).find(entry.filter).toArray();
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    chain: summarizeChain(pr, po, apri),
    documents: {
      pr,
      po,
      apri,
    },
    dependents,
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
  return { payload, outPath };
}

async function countAll(db) {
  return {
    purchaserequests: await db.collection('purchaserequests').countDocuments(),
    purchaseorders: await db.collection('purchaseorders').countDocuments(),
    apreserveinvoices: await db.collection('apreserveinvoices').countDocuments(),
    approvalhistories: await db.collection('approvalhistories').countDocuments(),
    comments: await db.collection('comments').countDocuments(),
    attachments: await db.collection('attachments').countDocuments(),
    emaillogs: await db.collection('emaillogs').countDocuments(),
    sapintegrationlogs: await db.collection('sapintegrationlogs').countDocuments(),
    systemsettings: await db.collection('systemsettings').countDocuments(),
    users: await db.collection('users').countDocuments(),
    roles: await db.collection('roles').countDocuments(),
    approvalmatrixes: await db.collection('approvalmatrixes').countDocuments(),
    emailgroups: await db.collection('emailgroups').countDocuments(),
    itemcreationlogs: await db.collection('itemcreationlogs').countDocuments(),
  };
}

async function verifyOrphans(db) {
  const orphanChecks = {};
  for (const entry of buildDependentCollections()) {
    orphanChecks[entry.name] = await db.collection(entry.name).countDocuments(entry.filter);
  }
  const docs = {
    pr: await db.collection('purchaserequests').countDocuments({ _id: oid(PR_ID) }),
    po: await db.collection('purchaseorders').countDocuments({ _id: oid(PO_ID) }),
    apri: await db.collection('apreserveinvoices').countDocuments({ _id: oid(APRI_ID) }),
  };
  return { orphanChecks, docs };
}

async function executeDelete(db) {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const deleted = {};

    for (const entry of buildDependentCollections()) {
      const result = await db.collection(entry.name).deleteMany(entry.filter, { session });
      deleted[entry.name] = result.deletedCount;
    }

    for (const doc of DELETE_DOCS) {
      const result = await db.collection(doc.collection).deleteOne({ _id: oid(doc.id) }, { session });
      deleted[doc.collection] = result.deletedCount;
    }

    await session.commitTransaction();
    return { committed: true, deleted };
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    await session.endSession();
  }
}

async function main() {
  const execute = process.argv.includes('--execute');
  loadDotEnv();
  loadEnvLocal();
  await connectMongo();
  const db = mongoose.connection.db;

  const before = await countAll(db);
  const { pr, po, apri } = await loadChain(db);
  assertChainIntegrity({ pr, po, apri });
  const summary = summarizeChain(pr, po, apri);
  const dependentBefore = await countDependents(db);

  console.log('=== Smoke test chain (pre-delete) ===');
  console.log(JSON.stringify(summary, null, 2));
  console.log('\n--- Dependent records ---');
  console.log(JSON.stringify(dependentBefore, null, 2));
  console.log('\n--- Collection totals before ---');
  console.log(JSON.stringify(before, null, 2));

  const exportPath = path.resolve(
    process.cwd(),
    'backup',
    'prpo_sv-20260713',
    `smoke-test-chain-${PR_ID}.json`,
  );
  const { outPath } = await exportChain(db, exportPath);
  console.log(`\nExported chain to ${outPath}`);

  if (!execute) {
    console.log('\nDRY-RUN only. Re-run with --execute to delete.');
    return;
  }

  const { deleted } = await executeDelete(db);
  const after = await countAll(db);
  const orphans = await verifyOrphans(db);

  console.log('\n=== Transaction: COMMITTED ===');
  console.log('--- Deleted counts ---');
  console.log(JSON.stringify(deleted, null, 2));
  console.log('\n--- Collection totals after ---');
  console.log(JSON.stringify(after, null, 2));
  console.log('\n--- Orphan / chain verification ---');
  console.log(JSON.stringify(orphans, null, 2));

  const chainGone =
    orphans.docs.pr === 0 && orphans.docs.po === 0 && orphans.docs.apri === 0;
  const noOrphans = Object.values(orphans.orphanChecks).every((n) => n === 0);
  if (!chainGone || !noOrphans) {
    throw new Error('Post-delete verification failed.');
  }
  console.log('\nVerification PASSED.');
}

main()
  .catch((err) => {
    console.error('Failed:', err.message || err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectMongo();
  });
