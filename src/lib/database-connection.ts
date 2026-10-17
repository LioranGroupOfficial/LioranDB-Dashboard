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

    console.log(uri);
    return uri;
  } catch {
    // URL parsing errors can contain credentials; never log or forward them.
    return null;
  }
}

/** Format the customer-facing root URI without changing the stored credentials. */
export function getRootConnectionUri(uri: string | null, port: number): string | null {
  const fullUri = getFullConnectionUri(uri);
  if (!fullUri) return null;

  try {
    const parsed = new URL(fullUri);
    // URL parsing removes default HTTPS ports; use this instance's actual port.
    const connectionPort = parsed.port || String(port);
    if (!Number.isInteger(Number(connectionPort)) || Number(connectionPort) < 1 || Number(connectionPort) > 65535) {
      return null;
    }
    // username/password are already percent-encoded. Preserve them without encoding again.
    return `liorandb://${parsed.username}:${parsed.password}@${parsed.hostname}:${connectionPort}/`;
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
  connectionUri: string | null;
  port: number;
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
  if (!getRootConnectionUri(db.connectionUri, db.port)) {
    return 'The complete connection URI is unavailable. Contact support if this persists.';
  }
  return null;
}
