/**
 * Safe MongoDB connectivity check — never prints credentials.
 * Usage: npm run db:check
 */
import { loadEnvLocal } from '../lib/loadEnvLocal.js';
import {
  connectMongo,
  disconnectMongo,
  getMongoUriSummary,
} from '../lib/mongodb.js';
import { formatMongoConnectionError } from '../lib/mongodbUri.js';

async function main() {
  const env = loadEnvLocal();
  console.log(`Env file: ${env.loaded ? env.path : '(not found — using process.env only)'}`);

  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not set. Copy .env.local.example to .env.local and configure MongoDB.');
    process.exit(1);
  }

  const { summary } = getMongoUriSummary();
  if (!summary?.ok) {
    console.error(`Invalid MONGODB_URI: ${summary?.message || 'unknown error'}`);
    process.exit(1);
  }

  console.log(`Scheme: ${summary.scheme}`);
  console.log(`Hosts: ${summary.hosts}`);
  console.log(`SRV: ${summary.isSrv ? 'yes' : 'no'}`);

  try {
    console.log('Connecting…');
    await connectMongo();
    const dbName = (await import('mongoose')).default.connection.name;
    console.log(`OK — connected to database "${dbName}"`);
    await disconnectMongo();
    process.exit(0);
  } catch (err) {
    console.error(formatMongoConnectionError(err.cause || err));
    process.exit(1);
  }
}

main();
