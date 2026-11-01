/** Validate for display/actions without normalizing or rebuilding saved credentials. */
export function getFullConnectionUri(uri: string | null): string | null {
  if (!uri || /[\s\u0000-\u001f\u007f]/.test(uri)) return null;

  try {
    const parsed = new URL(uri);
    if (!['liorandb:', 'liorandb+http:', 'liorandb+https:', 'http:', 'https:', 'grpc:'].includes(parsed.protocol)) {
      return null;
    }

    const username = decodeURIComponent(parsed.username);
    const password = decodeURIComponent(parsed.password);
    decodeURIComponent(parsed.pathname);
    if (!parsed.hostname || !username || !password || parsed.port === '0') return null;
    // A stored template or display mask is never a usable credential.
    if (/[<>]|\$\{|[•●]/.test(username + password) || /^\*+$/.test(password) || /^(?:REPLACE_WITH_.*|YOUR_PASSWORD|REDACTED)$/i.test(password)) {
      return null;
    }

    return uri;
  } catch {
    // URL parsing errors can contain credentials; never log or forward them.
    return null;
  }
}

/** Format the customer-facing URI without changing the stored credentials. */
export function getRootConnectionUri(
  uri: string | null,
  port: number,
  hostOverride?: string,
  databaseName?: string,
): string | null {
  const fullUri = getFullConnectionUri(uri);
  if (!fullUri) return null;

  try {
    const parsed = new URL(fullUri);
    let hostname = parsed.hostname;
    if (hostOverride?.trim()) {
      const hostUrl = new URL(
        /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(hostOverride.trim())
          ? hostOverride.trim()
          : `https://${hostOverride.trim()}`
      );
      if (!hostUrl.hostname) return null;
      hostname = hostUrl.hostname;
    }
    // URL parsing removes default HTTPS ports; use this instance's actual port.
    const connectionPort = parsed.port || String(port);
    if (!Number.isInteger(Number(connectionPort)) || Number(connectionPort) < 1 || Number(connectionPort) > 65535) {
      return null;
    }
    // username/password are already percent-encoded. Preserve them without encoding again.
    // The optional database name is authoritative for the allocation and is encoded as
    // one URI path segment so names such as "app_data/main" remain unambiguous.
    const database = databaseName?.trim();
    if (database && /[\s\u0000-\u001f\u007f?#]/.test(database)) return null;
    const databasePath = database ? encodeURIComponent(database) : '';
    return `liorandb://${parsed.username}:${parsed.password}@${hostname}:${connectionPort}/${databasePath}`;
  } catch {
    return null;
  }
}

export function maskConnectionUri(uri: string): string {
  try {
    const parsed = new URL(uri);
    if (!parsed.password) return 'Connection URI unavailable';
    parsed.password = '********';
    // Options may contain tokens or other secrets. Keep them only in revealed/copy values.
    if (parsed.search) parsed.search = '?options=hidden';
    if (parsed.hash) parsed.hash = '#hidden';
    return parsed.toString();
  } catch {
    return 'Connection URI unavailable';
  }
}

export interface DatabaseConnection {
  id?: string;
  connectionUri: string | null;
  host?: string;
  port: number;
  databaseName?: string;
  status: string;
  provisionedAt?: string;
  serverHealth?: string;
}

export function studioUnavailableReason(db: DatabaseConnection): string | null {
  if (['PENDING', 'PROVISIONING', 'STARTING', 'RESETTING'].includes(db.status)) {
    return 'Studio will be available when this database finishes starting.';
  }
  if (!['ACTIVE', 'RUNNING'].includes(db.status) || !db.provisionedAt) {
    return 'Studio requires a provisioned, running database.';
  }
  if (db.serverHealth && db.serverHealth !== 'HEALTHY') {
    return 'Studio is unavailable while this database is not healthy.';
  }
  if (!getRootConnectionUri(db.connectionUri, db.port, db.host, db.databaseName)) {
    return 'The complete connection URI is unavailable. Contact support if this persists.';
  }
  return null;
}

/** Availability checks for the server-side, one-time Studio handoff. */
export function studioHandoffUnavailableReason(db: DatabaseConnection): string | null {
  if (!db.id) return 'Studio handoff is unavailable for this database.';
  if (['PENDING', 'PROVISIONING', 'STARTING', 'RESETTING'].includes(db.status)) {
    return 'Studio will be available when this database finishes starting.';
  }
  if (!['ACTIVE', 'RUNNING'].includes(db.status) || !db.provisionedAt) {
    return 'Studio requires a provisioned, running database.';
  }
  if (db.serverHealth && db.serverHealth !== 'HEALTHY') {
    return 'Studio is unavailable while this database is not healthy.';
  }
  return null;
}
