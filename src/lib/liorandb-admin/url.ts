import { decrypt } from '@/lib/crypto';
import { LioranDBAdminError } from './errors';

export interface NodeEndpointInput {
  dbUrl?: string;
  host?: string;
  port?: number;
  protocol?: string;
  httpPort?: number;
  controlPlaneEndpoint?: string;
  encryptedControlPlaneToken?: string;
  encryptedControlPlaneCredential?: string;
  isDefault?: boolean;
}

/**
 * Checks if a given host or URL points to a loopback/localhost address.
 */
export function isLocalhost(rawHostOrUrl: string): boolean {
  if (!rawHostOrUrl || typeof rawHostOrUrl !== 'string') return false;

  let cleaned = rawHostOrUrl.trim().toLowerCase();
  cleaned = cleaned.replace(/^(https?:\/\/|grpc:\/\/|liorandb(\+(https?))?:\/\/)/i, '');
  cleaned = cleaned.split('/')[0].split('?')[0];

  if (cleaned.startsWith('[') && cleaned.endsWith(']')) {
    cleaned = cleaned.slice(1, -1);
  }

  if (cleaned === '::1' || cleaned === '0000:0000:0000:0000:0000:0000:0000:0001' || cleaned === '::') {
    return true;
  }

  // IPv4 or hostname:port splitting
  if (cleaned.includes(':') && !cleaned.includes('::')) {
    cleaned = cleaned.split(':')[0];
  }

  return (
    cleaned === '127.0.0.1' ||
    cleaned === 'localhost' ||
    cleaned === '0.0.0.0' ||
    cleaned.startsWith('127.') ||
    cleaned === 'localhost.localdomain'
  );
}

/**
 * Normalizes a control-plane URL into a canonical origin/base URL.
 *
 * Strips duplicate API prefixes like /v1, /v1/admin, trailing slashes,
 * and ensures valid HTTP/HTTPS protocol.
 *
 * Example:
 *   "http://127.0.0.1:27018/v1/admin/status" -> "http://127.0.0.1:27018"
 *   "https://db.example.com:8443/v1/"        -> "https://db.example.com:8443"
 *   "localhost:27018"                       -> "http://localhost:27018"
 */
export function normalizeControlPlaneUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') {
    throw new LioranDBAdminError('Invalid control-plane URL: URL must be a non-empty string.', {
      code: 'INVALID_CONTROL_PLANE_URL',
      statusCode: 500,
    });
  }

  let trimmed = rawUrl.trim();

  // If no scheme provided, default to http:// (or https if port 443/8443)
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//i.test(trimmed)) {
    if (trimmed.includes(':443') || trimmed.includes(':8443')) {
      trimmed = `https://${trimmed}`;
    } else {
      trimmed = `http://${trimmed}`;
    }
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch (err: unknown) {
    throw new LioranDBAdminError(
      `Invalid control-plane URL format '${rawUrl}': ${(err as Error).message}`,
      { code: 'INVALID_CONTROL_PLANE_URL', statusCode: 500 }
    );
  }

  // Validate protocol
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new LioranDBAdminError(
      `Unsupported control-plane protocol '${parsed.protocol}'. Only 'http:' and 'https:' are supported.`,
      { code: 'UNSUPPORTED_PROTOCOL', statusCode: 500 }
    );
  }

  const hostname = parsed.hostname.toLowerCase();
  const protocol = parsed.protocol; // includes ':' e.g. "http:"

  // Determine port
  let port = parsed.port;
  if (!port) {
    // Default ports: 27018 for localhost http, 80 for remote http, 443 for https
    if (protocol === 'http:' && isLocalhost(hostname)) {
      port = '27018';
    } else if (protocol === 'http:') {
      port = '80';
    } else {
      port = '443';
    }
  }

  // Omit standard default ports for clean canonical representation
  const isStandardHttp = protocol === 'http:' && port === '80';
  const isStandardHttps = protocol === 'https:' && port === '443';
  const portSegment = isStandardHttp || isStandardHttps ? '' : `:${port}`;

  return `${protocol}//${hostname}${portSegment}`;
}

/**
 * Resolves the effective authoritative control-plane URL for a hosting node or managed database.
 *
 * Precedence:
 * 1. Explicit URL parameter (if provided)
 * 2. Environment LIORANDB_CONTROL_PLANE_URL (if localhost node or development environment)
 * 3. Node/Instance controlPlaneEndpoint (with stale 8080 fix)
 * 4. Node/Instance host + httpPort/port + protocol
 * 5. Environment LIORANDB_CONTROL_PLANE_URL fallback
 * 6. Default: http://127.0.0.1:27018
 */
export function resolveControlPlaneEndpoint(
  nodeOrInstance?: NodeEndpointInput | null,
  explicitUrl?: string
): string {
  if (explicitUrl && explicitUrl.trim()) {
    return normalizeControlPlaneUrl(explicitUrl);
  }

  const envUrl = process.env.LIORANDB_CONTROL_PLANE_URL?.trim();

  // If node or instance provided
  if (nodeOrInstance) {
    const rawEndpoint = nodeOrInstance.controlPlaneEndpoint?.trim();
    const host = (nodeOrInstance.dbUrl || nodeOrInstance.host || '').trim();
    const protocol = (nodeOrInstance.protocol || 'http').toLowerCase() === 'https' ? 'https' : 'http';
    let httpPort = nodeOrInstance.httpPort || nodeOrInstance.port;

    const nodeIsLocal = isLocalhost(host) || (rawEndpoint ? isLocalhost(rawEndpoint) : false) || Boolean(nodeOrInstance.isDefault);

    // If it's a local development node and envUrl is configured, envUrl takes authoritative precedence
    if (nodeIsLocal && envUrl) {
      return normalizeControlPlaneUrl(envUrl);
    }

    // If explicit controlPlaneEndpoint is stored on node
    if (rawEndpoint) {
      // Auto-correct stale port 8080 on localhost
      if (isLocalhost(rawEndpoint) && rawEndpoint.includes(':8080')) {
        if (envUrl) {
          return normalizeControlPlaneUrl(envUrl);
        }
        return normalizeControlPlaneUrl('http://127.0.0.1:27018');
      }
      return normalizeControlPlaneUrl(rawEndpoint);
    }

    // Fallback using host + httpPort + protocol
    if (host) {
      // If port was 8080 on localhost, correct to 27018
      if (isLocalhost(host) && httpPort === 8080) {
        httpPort = 27018;
      }
      const portToUse = httpPort || (protocol === 'https' ? 443 : 27018);
      return normalizeControlPlaneUrl(`${protocol}://${host}:${portToUse}`);
    }
  }

  // Global Environment Override
  if (envUrl) {
    return normalizeControlPlaneUrl(envUrl);
  }

  // Canonical Default Local Development Endpoint
  return 'http://127.0.0.1:27018';
}

/**
 * Resolves the authenticated control-plane token for a hosting node or managed database.
 *
 * Precedence:
 * 1. Explicit token (if provided)
 * 2. Decrypted per-node / per-instance token
 * 3. Environment LIORANDB_CONTROL_PLANE_TOKEN / LIORANDB_CONTROL_PLANE_SECRET
 */
export function resolveControlPlaneToken(
  nodeOrInstance?: NodeEndpointInput | null,
  explicitToken?: string
): string | undefined {
  if (explicitToken && explicitToken.trim()) {
    return explicitToken.trim();
  }

  // Check per-node encrypted token
  if (nodeOrInstance?.encryptedControlPlaneToken) {
    try {
      const decrypted = decrypt(nodeOrInstance.encryptedControlPlaneToken);
      if (decrypted && decrypted.trim()) {
        return decrypted.trim();
      }
    } catch (err) {
      console.warn('[ControlPlane] Failed to decrypt node control-plane token:', (err as Error).message);
    }
  }

  // Check per-instance encrypted credential
  if (nodeOrInstance?.encryptedControlPlaneCredential) {
    try {
      const decrypted = decrypt(nodeOrInstance.encryptedControlPlaneCredential);
      if (decrypted && decrypted.trim()) {
        return decrypted.trim();
      }
    } catch (err) {
      console.warn('[ControlPlane] Failed to decrypt instance control-plane credential:', (err as Error).message);
    }
  }

  // Global Environment Token
  return (
    process.env.LIORANDB_CONTROL_PLANE_TOKEN?.trim() ||
    process.env.LIORANDB_CONTROL_PLANE_SECRET?.trim() ||
    undefined
  );
}
