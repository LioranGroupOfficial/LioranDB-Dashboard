import { LioranDBClient, Db, parseConnectionString } from '@liorandb/driver';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI && process.env.NODE_ENV !== 'test') {
  console.warn('[DB] MONGODB_URI environment variable is not defined');
}

declare global {
  // eslint-disable-next-line no-var
  var __liorandbClient: LioranDBClient | null;
  // eslint-disable-next-line no-var
  var __liorandbPromise: Promise<LioranDBClient> | null;
  // eslint-disable-next-line no-var
  var __liorandbDb: Db | null;
}

if (!global.__liorandbClient) {
  global.__liorandbClient = null;
  global.__liorandbPromise = null;
  global.__liorandbDb = null;
}

/**
 * Normalizes connection URI for the LioranDB TypeScript driver.
 * Supports liorandb://, liorandb+https://, https://, and standard formats.
 */
export function resolveLioranDBUri(): string {
  let uri = (process.env.MONGODB_URI || '').trim();
  if (!uri) {
    return 'liorandb://admin:admin@127.0.0.1:27018/lcs';
  }

  // If MongoDB prefix was provided, convert scheme for LioranDB driver
  if (uri.startsWith('mongodb://') || uri.startsWith('mongodb+srv://')) {
    uri = uri.replace(/^mongodb(\+srv)?:\/\//, 'liorandb://');
  }

  return uri;
}

/**
 * Establishes or reuses a singleton connection to the LioranDB database.
 */
export async function connectToDatabase(): Promise<{ client: LioranDBClient | null; db: Db | null }> {
  if (global.__liorandbClient && global.__liorandbClient.isConnected()) {
    return { client: global.__liorandbClient, db: global.__liorandbDb };
  }

  const uri = resolveLioranDBUri();

  if (!global.__liorandbPromise) {
    global.__liorandbPromise = (async () => {
      try {
        const client = await LioranDBClient.connect(uri, {
          tls: !uri.includes('127.0.0.1') && !uri.includes('localhost'),
          timeoutMS: 15000,
          connectTimeoutMS: 10000,
          requestTimeoutMS: 15000,
          maxRetries: 2,
        });

        const targetDbName = client.dbName || 'lcs';
        global.__liorandbClient = client;
        global.__liorandbDb = client.db(targetDbName);
        return client;
      } catch (err) {
        if (process.env.NODE_ENV !== 'test') {
          console.warn('[DB] LioranDB direct connection notice:', (err as Error).message);
        }
        global.__liorandbPromise = null;
        return null as unknown as LioranDBClient;
      }
    })();
  }

  try {
    const client = await global.__liorandbPromise;
    return { client: client || null, db: global.__liorandbDb || null };
  } catch {
    return { client: null, db: null };
  }
}

/**
 * Returns the active Db instance for data operations.
 */
export async function getDb(): Promise<Db | null> {
  const { db } = await connectToDatabase();
  return db;
}

/**
 * Returns the active LioranDB client instance.
 */
export async function getLioranDBClient(): Promise<LioranDBClient | null> {
  const { client } = await connectToDatabase();
  return client;
}

/**
 * Cleanly closes the active database client connection (for scripts and tests).
 */
export async function disconnectFromDatabase(): Promise<void> {
  if (global.__liorandbClient) {
    try {
      await global.__liorandbClient.close();
    } catch {
      // Ignore close errors
    } finally {
      global.__liorandbClient = null;
      global.__liorandbPromise = null;
      global.__liorandbDb = null;
    }
  }
}

export default connectToDatabase;
