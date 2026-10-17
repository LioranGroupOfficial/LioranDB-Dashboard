import {
  LioranDBClient,
  Db,
  parseConnectionString,
  ConfigurationError,
  ConnectionError,
  DRIVER_ERROR_CODES,
} from '@liorandb/driver';

declare global {
  var __liorandbClient: LioranDBClient | null;
  var __liorandbPromise: Promise<LioranDBClient> | null;
  var __liorandbDb: Db | null;
}

global.__liorandbClient ??= null;
global.__liorandbPromise ??= null;
global.__liorandbDb ??= null;

/**
 * Safely redacts credentials from a database connection URI for logging.
 */
export function redactUri(uri: string): string {
  if (!uri) return '[EMPTY_URI]';
  try {
    return uri.replace(/\/\/([^:/?#]+):([^@/?#]*)@/u, '//$1:****@');
  } catch {
    return '[REDACTED_URI]';
  }
}

/**
 * Normalizes and validates the connection URI for the LioranDB TypeScript driver.
 * Supports liorandb://, liorandb+https://, https://, and mongodb:// migration schemes.
 * Ensures the target database is explicitly defined (defaults to 'lcs' for Connexus).
 */
export function resolveLioranDBUri(): string {
  let uri = (process.env.MONGODB_URI || process.env.LIORANDB_URI || '').trim();

  if (!uri) {
    if (process.env.NODE_ENV === 'production') {
      throw new ConfigurationError(
        'Production database connection URI is missing. Define MONGODB_URI or LIORANDB_URI in the environment.'
      );
    }
    if (process.env.NODE_ENV === 'test') {
      return 'liorandb://admin:admin@127.0.0.1:27018/lcs';
    }
    throw new ConfigurationError(
      'MONGODB_URI or LIORANDB_URI environment variable is not defined.'
    );
  }

  // Convert legacy MongoDB connection schemes to native LioranDB driver schemes
  if (uri.startsWith('mongodb+srv://')) {
    uri = uri.replace(/^mongodb\+srv:\/\//, 'liorandb+https://');
  } else if (uri.startsWith('mongodb://')) {
    uri = uri.replace(/^mongodb:\/\//, 'liorandb://');
  }

  // Parse and validate using @liorandb/driver connection parser
  try {
    const parsed = parseConnectionString(uri);
    if (!parsed.host) {
      throw new ConfigurationError('LioranDB connection URI must include a valid host.');
    }
  } catch (err) {
    if (err instanceof ConfigurationError) throw err;
    throw new ConfigurationError(
      `Invalid LioranDB connection URI: ${redactUri(uri)} - ${(err as Error).message}`,
      { cause: err }
    );
  }

  return uri;
}

/**
 * Establishes or reuses a singleton connection to the hosted LioranDB database.
 * Failed attempts are discarded so the next request can reconnect.
 * Callers still receive an error when no real connection is available.
 */
export async function connectToDatabase(): Promise<{ client: LioranDBClient; db: Db }> {
  if (global.__liorandbClient && global.__liorandbClient.isConnected() && global.__liorandbDb) {
    return { client: global.__liorandbClient, db: global.__liorandbDb };
  }

  if (!global.__liorandbPromise) {
    const previousClient = global.__liorandbClient;
    global.__liorandbClient = null;
    global.__liorandbDb = null;
    global.__liorandbPromise = createDatabaseConnection(previousClient);
  }

  // Every concurrent caller waits on the same attempt. An older caller must
  // never clear a newer attempt that started after its own connection failed.
  const attempt = global.__liorandbPromise;
  try {
    const client = await attempt;
    if (!client.isConnected() || !global.__liorandbDb) {
      throw new ConnectionError('Database service is temporarily unavailable. Please try again.');
    }
    return { client, db: global.__liorandbDb };
  } finally {
    if (global.__liorandbPromise === attempt) {
      global.__liorandbPromise = null;
    }
  }
}

async function createDatabaseConnection(previousClient: LioranDBClient | null): Promise<LioranDBClient> {
  let client: LioranDBClient | null = null;
  try {
    if (previousClient) {
      try {
        await previousClient.close();
      } catch {
        // A stale client must not prevent the next connection attempt.
      }
    }

    const uri = resolveLioranDBUri();
    const parsed = parseConnectionString(uri);
    const targetDbName = parsed.database || 'lcs';
    const isTls =
      parsed.scheme === 'liorandb+https' ||
      parsed.scheme === 'https' ||
      parsed.port === 443 ||
      parsed.port === 8443 ||
      (!parsed.isLoopbackHost && !uri.includes('127.0.0.1') && !uri.includes('localhost'));

    const transport = (process.env.LIORANDB_TRANSPORT as 'grpc' | 'http' | 'auto') || 'grpc';
    const allowHttpFallback = process.env.LIORANDB_ALLOW_HTTP_FALLBACK === 'true';

    // Retain the client even if connect() fails, so its resources can close.
    client = new LioranDBClient(uri, {
      tls: isTls,
      transport,
      allowHttpFallback,
      timeoutMS: 15000,
      connectTimeoutMS: 10000,
      requestTimeoutMS: 15000,
      maxRetries: 2,
    });
    await client.connect();

    if (!client.isConnected()) {
      throw new ConnectionError('LioranDBClient.connect() completed but client is not marked connected.');
    }

    // Idempotently ensure the target application logical database exists on the instance
    try {
      await client.createDatabase(targetDbName);
    } catch (dbErr: unknown) {
      const errMsg = String((dbErr as Error)?.message || '').toLowerCase();
      const dbErrObj = dbErr as { code?: string; name?: string } | null;
      const isConflict =
        dbErrObj?.code === DRIVER_ERROR_CODES.CONFLICT ||
        dbErrObj?.name === 'ConflictError' ||
        errMsg.includes('already exists') ||
        errMsg.includes('conflict');
      if (!isConflict) {
        // Log notice if creation returned an unexpected code, but proceed since db might exist
        console.warn('[DB] Could not verify the application database; continuing with the connected client.');
      }
    }

    const db = client.db(targetDbName);
    global.__liorandbClient = client;
    global.__liorandbDb = db;

    // Auto-initialize Connexus collections and declared indexes in the background
    if (targetDbName === 'lcs') {
      (async () => {
        try {
          const { initConnexusCollectionsAndIndexes } = await import('./index');
          await initConnexusCollectionsAndIndexes(db);
        } catch {
          console.warn('[DB] Could not initialize application collections and indexes.');
        }
      })();
    }

    return client;
  } catch {
    if (client) {
      try {
        await client.close();
      } catch {
        // Closing a failed client must not replace the recoverable connection error.
      }
    }
    // Do not log URIs or driver errors, which may carry credentials or config.
    console.warn('[DB] Database connection failed. The next request will retry.');
    throw new ConnectionError('Database service is temporarily unavailable. Please try again.');
  }
}

/**
 * Returns the active Db instance for data operations.
 * Throws if the database connection cannot be established.
 */
export async function getDb(): Promise<Db> {
  const { db } = await connectToDatabase();
  return db;
}

/**
 * Returns the active LioranDB client instance.
 * Throws if the database connection cannot be established.
 */
export async function getLioranDBClient(): Promise<LioranDBClient> {
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
