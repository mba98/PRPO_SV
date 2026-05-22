import path from 'node:path';
import { fileURLToPath } from 'node:url';
import SystemSettings from '../models/SystemSettings.js';
import { loadEnvLocal } from '../lib/loadEnvLocal.js';
import { connectMongo, disconnectMongo, getMongoUriSummary } from '../lib/mongodb.js';
import { formatMongoConnectionError } from '../lib/mongodbUri.js';

/** Confirmed SAP GUI: Main branch → BPL -2 */
export const DEFAULT_BRANCH_MAP = {
  Procurement: -2,
  default: -2,
};

/** Confirmed SAP GUI: Department General */
export const DEFAULT_SAP_DEPARTMENT_MAP = {
  Procurement: 'General',
  default: 'General',
};

/**
 * Upsert SAP PR-related system_settings (safe on non-empty DB).
 */
export async function upsertSapPrSettings() {
  const force = process.env.FORCE_UPDATE_SAP_SETTINGS === 'true';
  const results = { updated: [], unchanged: [] };

  const entries = [
    { key: 'branch_map', value: DEFAULT_BRANCH_MAP },
    { key: 'sap_department_map', value: DEFAULT_SAP_DEPARTMENT_MAP },
  ];

  for (const { key, value } of entries) {
    const existing = await SystemSettings.findOne({ key }).lean();
    if (existing && !force) {
      results.unchanged.push(key);
      console.log(`SAP setting unchanged: ${key}`);
      continue;
    }
    await SystemSettings.updateOne(
      { key },
      { $set: { key, value } },
      { upsert: true },
    );
    results.updated.push(key);
    console.log(`Updated SAP setting: ${key}`);
  }

  return results;
}

async function main() {
  loadEnvLocal();

  if (!process.env.MONGODB_URI) {
    throw new Error(
      'MONGODB_URI is required. Copy .env.local.example to .env.local and set your Atlas URI.',
    );
  }

  const { summary } = getMongoUriSummary();
  if (summary?.ok) {
    console.log(`MongoDB target: ${summary.scheme}://${summary.hosts}`);
  }

  await connectMongo();
  console.log('Connected to MongoDB');

  try {
    const results = await upsertSapPrSettings();
    console.log(
      `SAP settings seed completed (${results.updated.length} updated, ${results.unchanged.length} unchanged)`,
    );
  } finally {
    await disconnectMongo();
  }
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  main().catch((err) => {
    const message = err.cause ? formatMongoConnectionError(err.cause) : err.message;
    console.error('Seed settings failed:', message);
    process.exit(1);
  });
}
