import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI && process.env.NODE_ENV !== 'test') {
  console.warn('[DB] MONGODB_URI environment variable is not defined');
}

declare global {
  // eslint-disable-next-line no-var
  var __mongoose: {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
  };
}

if (!global.__mongoose) {
  global.__mongoose = { conn: null, promise: null };
}

export async function connectToDatabase(): Promise<typeof mongoose> {
  if (global.__mongoose.conn) {
    return global.__mongoose.conn;
  }

  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable is not defined');
  }

  if (!global.__mongoose.promise) {
    global.__mongoose.promise = mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
    });
  }

  global.__mongoose.conn = await global.__mongoose.promise;
  return global.__mongoose.conn;
}

export default connectToDatabase;
