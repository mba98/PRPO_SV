import mongoose from 'mongoose';
import '@/models/index.js';
import {
  formatMongoConnectionError,
  normalizeMongoUri,
  summarizeMongoUri,
  validateMongoUri,
} from './mongodbUri.js';

/** Shared driver options for app, seed, and db:check */
export const MONGO_CONNECT_OPTIONS = {
  serverSelectionTimeoutMS: 30000,
  connectTimeoutMS: 30000,
};

function getMongoUri() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not defined in environment variables');
  }
  return normalizeMongoUri(uri);
}

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

/**
 * Connect with normalized URI and standard timeouts. Throws enriched errors.
 */
export async function connectMongo(uri) {
  const resolved = normalizeMongoUri(uri || getMongoUri());
  validateMongoUri(resolved);

  try {
    await mongoose.connect(resolved, MONGO_CONNECT_OPTIONS);
    return mongoose.connection;
  } catch (err) {
    const wrapped = new Error(formatMongoConnectionError(err));
    wrapped.cause = err;
    throw wrapped;
  }
}

/**
 * Disconnect (seed / db:check).
 */
export async function disconnectMongo() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

/**
 * Safe URI summary for logs (no credentials).
 */
export function getMongoUriSummary() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    return { configured: false, summary: null };
  }
  return { configured: true, summary: summarizeMongoUri(uri) };
}

/**
 * Connect to MongoDB (reuses connection in dev).
 */
export async function connectDB() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = connectMongo().then(() => mongoose.connection);
  }

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (err) {
    cached.promise = null;
    throw err;
  }
}

/**
 * Ping MongoDB for health checks.
 */
export async function pingMongo() {
  await connectDB();
  const admin = mongoose.connection.db.admin();
  const result = await admin.ping();
  return result?.ok === 1;
}
