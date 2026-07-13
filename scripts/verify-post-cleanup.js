/**
 * Verify collection counts and counters after test-data cleanup.
 */
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { loadEnvLocal } from '../lib/loadEnvLocal.js';
import { connectMongo, disconnectMongo } from '../lib/mongodb.js';

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

const EXPECTED_ZERO = [
  'purchaserequests',
  'purchaseorders',
  'apreserveinvoices',
  'localpurchases',
  'approvalhistories',
  'comments',
  'attachments',
  'emaillogs',
];

const COUNTER_KEY_PATTERN = /^(pr|po|apri|lp)_seq_\d{8}$/i;

async function main() {
  loadDotEnv();
  loadEnvLocal();
  await connectMongo();
  const db = mongoose.connection.db;

  const counts = {};
  for (const name of [...EXPECTED_ZERO, 'sapintegrationlogs']) {
    counts[name] = await db.collection(name).countDocuments();
  }

  const counters = await db
    .collection('systemsettings')
    .find({ key: { $regex: COUNTER_KEY_PATTERN } })
    .project({ key: 1, seq: 1, value: 1 })
    .toArray();

  console.log('=== Post-cleanup verification ===');
  for (const name of EXPECTED_ZERO) {
    const ok = counts[name] === 0;
    console.log(`${name}: ${counts[name]} ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log(`sapintegrationlogs: ${counts.sapintegrationlogs} ${counts.sapintegrationlogs === 17 ? 'OK' : 'FAIL'}`);
  console.log(`counters preserved: ${counters.length} row(s)`);
  for (const row of counters.sort((a, b) => String(a.key).localeCompare(String(b.key)))) {
    const seq = row.seq ?? row.value?.seq ?? '?';
    console.log(`  ${row.key}: seq=${seq}`);
  }

  const failures = EXPECTED_ZERO.filter((name) => counts[name] !== 0);
  if (counts.sapintegrationlogs !== 17) failures.push('sapintegrationlogs!=17');
  if (failures.length) {
    process.exitCode = 1;
    console.error('Verification FAILED:', failures.join(', '));
  } else {
    console.log('Verification PASSED.');
  }
}

main()
  .catch((err) => {
    console.error(err.message || err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectMongo();
  });
