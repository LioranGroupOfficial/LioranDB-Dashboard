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
 * Validates a hostname or IP against SSRF blacklists (metadata services, private ranges in production).
 */
export function validateHostnameSSRF(hostname: string, allowPrivate = false): void {
  const h = hostname.toLowerCase().trim();

  // Cloud metadata services - always blocked
  if (
    h === '169.254.169.254' ||
    h === '169.254.170.2' ||
    h === 'metadata.google.internal' ||
    h === 'metadata.goog' ||
    h === '100.100.100.200' ||
    h.startsWith('169.254.')
  ) {
    throw new LioranDBAdminError(`Access to cloud metadata destination '${h}' is prohibited.`, {
      code: 'SSRF_BLOCKED',
      statusCode: 400,
    });
  }

  // In production, block internal private IP ranges unless explicitly allowed
  const isProd = process.env.NODE_ENV === 'production';
  const allowPrivateEnv = process.env.ALLOW_PRIVATE_CONTROL_PLANE === 'true' || process.env.LIORANDB_ALLOW_LOCALHOST === 'true';

  if (isProd && !allowPrivate && !allowPrivateEnv) {
    if (
      h === 'localhost' ||
      h === 'localhost.localdomain' ||
      h === '::1' ||
      h === '0.0.0.0' ||
      h.startsWith('127.') ||
      h.startsWith('10.') ||
      h.startsWith('192.168.') ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(h)
    ) {
      throw new LioranDBAdminError(`Access to private or loopback destination '${h}' is not permitted in production.`, {
        code: 'SSRF_PRIVATE_BLOCKED',
        statusCode: 400,
      });
    }
  }
}

/**
 * Normalizes a control-plane URL into a canonical origin/base URL.
 *
 * Strips duplicate API prefixes like /v1, /v1/admin, trailing slashes,
 * and ensures valid HTTP/HTTPS protocol with SSRF validation.
 *
 * Example:
 *   "https://cx01.manage.db.liorandb.com/v1/admin/status" -> "https://cx01.manage.db.liorandb.com"
 *   "http://127.0.0.1:27018/v1/admin/status"              -> "http://127.0.0.1:27018"
 */
export function normalizeControlPlaneUrl(rawUrl: string, options?: { allowPrivate?: boolean }): string {
  if (!rawUrl || typeof rawUrl !== 'string') {
    throw new LioranDBAdminError('Invalid control-plane URL: URL must be a non-empty string.', {
      code: 'INVALID_CONTROL_PLANE_URL',
      statusCode: 500,
    });
  }

  let trimmed = rawUrl.trim();

  // If no scheme provided, default to http:// for localhost/27018, https:// for remote domains
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//i.test(trimmed)) {
    if (trimmed.includes(':443') || trimmed.includes(':8443') || !isLocalhost(trimmed)) {
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
  const protocol = parsed.protocol; // includes ':' e.g. "http:" or "https:"

  // Enforce SSRF validation
  validateHostnameSSRF(hostname, options?.allowPrivate);

  // In production, enforce HTTPS for public management endpoints
  const isProd = process.env.NODE_ENV === 'production';
  if (isProd && protocol === 'http:' && !isLocalhost(hostname) && process.env.ALLOW_INSECURE_HTTP !== 'true') {
    throw new LioranDBAdminError(
      `Insecure HTTP is not allowed for public management endpoint '${hostname}'. HTTPS is required.`,
      { code: 'HTTPS_REQUIRED', statusCode: 400 }
    );
  }

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
