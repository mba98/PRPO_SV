import mongoose from 'mongoose';

function getMongoUri() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not defined in environment variables');
  }
  return uri;
}

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

/**
 * Connect to MongoDB (reuses connection in dev).
 */
export async function connectDB() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(getMongoUri(), {
      bufferCommands: false,
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
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
