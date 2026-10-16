/**
 * Typed Infrastructure Errors for Docker Management Control Plane
 *
 * All errors redact sensitive gateway tokens and panel keys to prevent accidental
 * leakage in client responses, logs, or debugging output.
 */

export function redactSensitiveStrings(text: string): string {
  if (!text) return '';
  return text
    .replace(/(?:x-lioran-gateway-token|gateway-token|gateway_token)[\s:=]+[a-zA-Z0-9_\-.]+/gi, 'X-Lioran-Gateway-Token: [REDACTED]')
    .replace(/(?:x-lioran-panel-key|panel-key|panel_key|control-plane-key|control_plane_key)[\s:=]+[a-zA-Z0-9_\-.]+/gi, 'X-Lioran-Panel-Key: [REDACTED]')
    .replace(/Bearer\s+[a-zA-Z0-9_\-.]+/gi, 'Bearer [REDACTED]')
    .replace(/(?:password|token|secret|key|authorization)[\s:=]+[a-zA-Z0-9_\-.]+/gi, '$1=[REDACTED]');
}

export class DockerManagementError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly nodeId?: string;
  public readonly requestId?: string;
  public readonly safeMessage: string;

  constructor(
    message: string,
    options: {
      statusCode?: number;
      code?: string;
      nodeId?: string;
      requestId?: string;
      cause?: unknown;
    } = {}
  ) {
    const redacted = redactSensitiveStrings(message);
    super(redacted);
    this.name = 'DockerManagementError';
    this.statusCode = options.statusCode || 500;
    this.code = options.code || 'DOCKER_MANAGEMENT_ERROR';
    this.nodeId = options.nodeId;
    this.requestId = options.requestId;
    this.safeMessage = redacted;
    if (options.cause) {
      this.cause = options.cause;
    }
  }
}

export class DockerAuthenticationError extends DockerManagementError {
  constructor(
    message = 'Docker management gateway authentication failed (HTTP 401/403). Check LIORANDB_MANAGEMENT_GATEWAY_TOKEN and LIORANDB_CONTROL_PLANE_KEY.',
    options?: { nodeId?: string; requestId?: string; cause?: unknown }
  ) {
    super(message, { statusCode: 403, code: 'DOCKER_AUTHENTICATION_FAILED', ...options });
    this.name = 'DockerAuthenticationError';
  }
}

export class DockerNodeNotFoundError extends DockerManagementError {
  constructor(
    message = 'Managed container not found on Docker management control plane (HTTP 404)',
    options?: { nodeId?: string; requestId?: string; cause?: unknown }
  ) {
    super(message, { statusCode: 404, code: 'DOCKER_NODE_NOT_FOUND', ...options });
    this.name = 'DockerNodeNotFoundError';
  }
}

export class DockerTimeoutError extends DockerManagementError {
  constructor(
    message = 'Docker management control plane request timed out',
    options?: { nodeId?: string; requestId?: string; cause?: unknown }
  ) {
    super(message, { statusCode: 504, code: 'DOCKER_TIMEOUT', ...options });
    this.name = 'DockerTimeoutError';
  }
}

export class DockerUnreachableError extends DockerManagementError {
  constructor(
    message = 'Cannot reach Docker management service (https://pan.liorandb.com)',
    options?: { nodeId?: string; requestId?: string; cause?: unknown }
  ) {
    super(message, { statusCode: 503, code: 'DOCKER_SERVICE_UNREACHABLE', ...options });
    this.name = 'DockerUnreachableError';
  }
}

export class DockerConflictError extends DockerManagementError {
  constructor(
    message = 'Conflict performing Docker container operation',
    options?: { nodeId?: string; requestId?: string; cause?: unknown }
  ) {
    super(message, { statusCode: 409, code: 'DOCKER_CONFLICT', ...options });
    this.name = 'DockerConflictError';
  }
}

export class DockerNodeNotAllowedError extends DockerManagementError {
  constructor(
    invalidNode: string,
    options?: { requestId?: string; cause?: unknown }
  ) {
    super(
      `Node '${invalidNode}' is not in the allowlist of managed Docker nodes (allowed: cx01..cx07).`,
      { statusCode: 400, code: 'DOCKER_NODE_NOT_ALLOWED', nodeId: invalidNode, ...options }
    );
    this.name = 'DockerNodeNotAllowedError';
  }
}

export class DockerCapabilityUnsupportedError extends DockerManagementError {
  constructor(
    capability = 'Physical volume reset',
    options?: { nodeId?: string; requestId?: string; cause?: unknown }
  ) {
    super(
      `${capability} capability is not supported by the management service API at https://pan.liorandb.com. Storage reset requires verified backend capability deployment. Node must fail closed into QUARANTINED state.`,
      { statusCode: 501, code: 'DOCKER_CAPABILITY_UNSUPPORTED', ...options }
    );
    this.name = 'DockerCapabilityUnsupportedError';
  }
}

export function sanitizeDockerErrorForLog(err: unknown): Record<string, unknown> {
  if (err instanceof DockerManagementError) {
    return {
      name: err.name,
      message: err.safeMessage,
      code: err.code,
      statusCode: err.statusCode,
      nodeId: err.nodeId,
      requestId: err.requestId,
    };
  }
  if (err instanceof Error) {
    return {
      name: err.name,
      message: redactSensitiveStrings(err.message),
    };
  }
  return { error: redactSensitiveStrings(String(err)) };
}
