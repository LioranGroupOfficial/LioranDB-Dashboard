/**
 * Native LioranDB Connection URI Generator & Parser
 *
 * Implements the official @liorandb/driver native connection scheme:
 *   liorandb://username:password@host:port/database
 *
 * Also supports:
 *   liorandb+http://, liorandb+https://, http://, https://, grpc://
 *
 * Handles RFC-3986 percent-encoding for usernames, passwords, and database names
 * containing special characters (@, :, /, ?, #, %, &, etc.).
 */

export type LioranDBScheme =
  | 'liorandb'
  | 'liorandb+http'
  | 'liorandb+https'
  | 'http'
  | 'https'
  | 'grpc';

function rfc3986Encode(str: string): string {
  return encodeURIComponent(str).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

export interface LioranDBConnectionUriOptions {
  username?: string;
  password?: string;
  host: string;
  port?: number;
  database?: string;
  databaseName?: string;
  scheme?: LioranDBScheme;
  tls?: boolean;
  transport?: 'grpc' | 'http';
  appName?: string;
  authSource?: string;
  options?: Record<string, string | number | boolean>;
}

export interface ParsedLioranDBUri {
  scheme: LioranDBScheme;
  username?: string;
  password?: string;
  host: string;
  port: number;
  database: string;
  databaseName: string;
  tls?: boolean;
  transport?: 'grpc' | 'http';
  appName?: string;
  authSource?: string;
  options: Record<string, string>;
  raw: string;
}

/**
 * Builds a canonical native LioranDB connection URI with strict percent-encoding.
 */
export function buildLioranDBConnectionUri(options: LioranDBConnectionUriOptions): string {
  const scheme = options.scheme || 'liorandb';
  let host = (options.host || '127.0.0.1').trim();

  // Strip any leading protocol accidentally passed in host
  host = host.replace(/^(https?:\/\/|grpc:\/\/|liorandb(\+(https?))?:\/\/|mongodb:\/\/)/i, '');
  host = host.split('/')[0].split('?')[0];

  let port = options.port;
  if (host.includes(':') && !host.startsWith('[')) {
    const [h, p] = host.split(':');
    host = h;
    if (!port) {
      port = parseInt(p, 10);
    }
  }

  // Format IPv6 hosts
  if (host.includes(':') && !host.startsWith('[')) {
    host = `[${host}]`;
  }

  const normalizedPort = port && port > 0 ? port : 27018;
  const rawDb = options.databaseName || options.database || 'default';
  const database = rawDb.replace(/^\/+/, '').trim() || 'default';

  let userInfo = '';
  if (options.username && options.password !== undefined) {
    const encodedUser = rfc3986Encode(options.username);
    const encodedPass = rfc3986Encode(options.password);
    userInfo = `${encodedUser}:${encodedPass}@`;
  }

  const queryParams = new URLSearchParams();
  if (options.tls !== undefined) {
    queryParams.set('tls', options.tls ? 'true' : 'false');
  }
  if (options.transport) {
    queryParams.set('transport', options.transport);
  }
  if (options.appName) {
    queryParams.set('appName', options.appName);
  }
  if (options.authSource) {
    queryParams.set('authSource', options.authSource);
  }

  if (options.options) {
    for (const [key, val] of Object.entries(options.options)) {
      if (val !== undefined) {
        queryParams.set(key, String(val));
      }
    }
  }

  const queryString = queryParams.toString();
  const querySuffix = queryString ? `?${queryString}` : '';

  return `${scheme}://${userInfo}${host}:${normalizedPort}/${rfc3986Encode(database)}${querySuffix}`;
}

/**
 * Parses and validates a native LioranDB connection URI according to driver specifications.
 */
export function parseLioranDBConnectionUri(uri: string): ParsedLioranDBUri {
  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch (err) {
    throw new Error(`Invalid LioranDB connection URI format: ${(err as Error).message}`);
  }

  const rawProtocol = parsed.protocol.replace(/:$/, '') as LioranDBScheme;
  const allowedSchemes: LioranDBScheme[] = [
    'liorandb',
    'liorandb+http',
    'liorandb+https',
    'http',
    'https',
    'grpc',
  ];

  if (!allowedSchemes.includes(rawProtocol)) {
    throw new Error(`Unsupported LioranDB URI scheme: '${rawProtocol}'. Expected 'liorandb://'`);
  }

  const username = parsed.username ? decodeURIComponent(parsed.username) : undefined;
  const password = parsed.password ? decodeURIComponent(parsed.password) : undefined;
  const host = parsed.hostname;
  const port = parsed.port ? parseInt(parsed.port, 10) : 27018;
  const database = parsed.pathname ? decodeURIComponent(parsed.pathname.replace(/^\/+/, '')) || 'default' : 'default';

  const tlsParam = parsed.searchParams.get('tls');
  const tls = tlsParam === 'true' ? true : tlsParam === 'false' ? false : undefined;
  const transportParam = parsed.searchParams.get('transport');
  const transport = transportParam === 'grpc' || transportParam === 'http' ? transportParam : undefined;
  const appName = parsed.searchParams.get('appName') || undefined;
  const authSource = parsed.searchParams.get('authSource') || undefined;

  const optionsMap: Record<string, string> = {};
  parsed.searchParams.forEach((val, key) => {
    optionsMap[key] = val;
  });

  return {
    scheme: rawProtocol,
    username,
    password,
    host,
    port,
    database,
    databaseName: database,
    tls,
    transport,
    appName,
    authSource,
    options: optionsMap,
    raw: uri,
  };
}

/**
 * Safely masks database credentials in a URI for logging or display.
 */
export function maskLioranDBConnectionUri(uri: string): string {
  try {
    const parsed = new URL(uri);
    if (parsed.password) {
      parsed.password = '*****';
    }
    return parsed.toString();
  } catch {
    return uri.replace(/:([^@/]+)@/, ':*****@');
  }
}
