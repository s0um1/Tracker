import mongoose from "mongoose";
import { ensureDatabaseIndexes } from "@/lib/db-indexes";

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var _mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache = global._mongooseCache ?? { conn: null, promise: null };
global._mongooseCache = cached;

let indexesReady: Promise<void> | null = null;

async function runIndexMigration(): Promise<void> {
  if (!indexesReady) {
    // ponytail: don't reset on failure — retries were re-triggering broken index builds
    indexesReady = ensureDatabaseIndexes();
  }
  await indexesReady;
}

export async function connectToDatabase(): Promise<typeof mongoose> {
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    throw new Error("Missing MONGODB_URI environment variable");
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
    });
  }

  try {
    if (!cached.conn) {
      cached.conn = await cached.promise;
    }
    // ponytail: indexes sync in background — avoids blocking every API on cold start
    void runIndexMigration().catch((err) => {
      console.error(
        "[mongodb] index migration failed:",
        err instanceof Error ? err.message : err
      );
    });
  } catch (err) {
    cached.promise = null;
    cached.conn = null;
    throw err;
  }

  return cached.conn;
}
