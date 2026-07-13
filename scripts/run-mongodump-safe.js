/**
 * Run mongodump without printing MONGODB_URI or credentials.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { loadEnvLocal } from '../lib/loadEnvLocal.js';
import { getMongoUriSummary } from '../lib/mongodb.js';

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

function findMongodump() {
  const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
  const toolsRoot = path.join(programFiles, 'MongoDB', 'Tools');
  const fromToolsDir = [];
  if (fs.existsSync(toolsRoot)) {
    for (const entry of fs.readdirSync(toolsRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const candidate = path.join(toolsRoot, entry.name, 'bin', 'mongodump.exe');
      if (fs.existsSync(candidate)) fromToolsDir.push(candidate);
    }
  }

  const candidates = [
    process.env.MONGODUMP_PATH,
    ...fromToolsDir,
    'mongodump',
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (candidate.includes(path.sep) || candidate.includes('/')) {
      if (fs.existsSync(candidate)) return candidate;
      continue;
    }
    const which = spawnSync('where.exe', [candidate], { encoding: 'utf8' });
    if (which.status === 0) {
      const first = which.stdout.split(/\r?\n/).find((l) => l.trim());
      if (first) return first.trim();
    }
  }
  return null;
}

function redactSecrets(text, uri) {
  if (!text || !uri) return text;
  return text.split(uri).join('[REDACTED_URI]');
}

function extractDatabaseName(uri) {
  const withoutQuery = uri.trim().split('?')[0];
  const slash = withoutQuery.lastIndexOf('/');
  if (slash === -1) return null;
  return withoutQuery.slice(slash + 1) || null;
}

async function main() {
  loadDotEnv();
  loadEnvLocal();

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set.');

  const { summary } = getMongoUriSummary();
  if (!summary?.ok) {
    throw new Error(`Invalid MONGODB_URI: ${summary?.message || 'unknown error'}`);
  }

  const dbName = extractDatabaseName(uri);
  if (!dbName) throw new Error('Could not parse database name from MONGODB_URI.');

  const outDir = path.resolve(process.cwd(), process.argv[2] || 'backup/prpo_sv-20260713');
  fs.mkdirSync(outDir, { recursive: true });

  const mongodump = findMongodump();
  if (!mongodump) throw new Error('mongodump executable not found in PATH or Program Files.');

  console.log(`mongodump: ${mongodump}`);
  console.log(`database: ${dbName}`);
  console.log(`output: ${outDir}`);
  console.log(`hosts: ${summary.hosts}`);
  console.log(`scheme: ${summary.scheme}`);

  const started = Date.now();
  const result = spawnSync(mongodump, ['--uri', uri, '--db', dbName, '--out', outDir], {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });

  const elapsedSec = ((Date.now() - started) / 1000).toFixed(1);
  if (result.stdout?.trim()) {
    console.log(redactSecrets(result.stdout.trim(), uri));
  }
  if (result.stderr?.trim()) {
    console.error(redactSecrets(result.stderr.trim(), uri));
  }

  if (result.status !== 0) {
    throw new Error(`mongodump failed with exit code ${result.status} after ${elapsedSec}s`);
  }

  const dbDumpDir = path.join(outDir, dbName);
  if (!fs.existsSync(dbDumpDir)) {
    throw new Error(`Expected dump folder missing: ${dbDumpDir}`);
  }

  const bsonFiles = fs.readdirSync(dbDumpDir).filter((name) => name.endsWith('.bson'));
  const nonEmpty = bsonFiles.filter((name) => fs.statSync(path.join(dbDumpDir, name)).size > 0);
  console.log(`mongodump completed in ${elapsedSec}s`);
  console.log(`bson files: ${bsonFiles.length} (${nonEmpty.length} non-empty)`);
  if (!nonEmpty.length) {
    throw new Error('mongodump produced no non-empty BSON files.');
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exitCode = 1;
});
