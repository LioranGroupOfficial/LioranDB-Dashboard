function redactSensitiveStrings(text: string): string {
  if (!text) return '';
  return text
    .replace(/Bearer\s+[a-zA-Z0-9_\-.]+/gi, 'Bearer [REDACTED]')
    .replace(/(?:x-lioran-gateway-token|gateway-token|gateway_token)[\s:=]+[a-zA-Z0-9_\-.]+/gi, 'X-Lioran-Gateway-Token: [REDACTED]')
    .replace(/(?:password|token|secret|key|authorization)[\s:=]+[a-zA-Z0-9_\-.]+/gi, '$1=[REDACTED]');
}

export class LioranDBAdminError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly requestId?: string;
  public readonly safeMessage: string;

  constructor(
    message: string,
    options: {
      statusCode?: number;
      code?: string;
      requestId?: string;
      cause?: unknown;
    } = {}
  ) {
    super(redactSensitiveStrings(message));
    this.name = 'LioranDBAdminError';
    this.statusCode = options.statusCode || 500;
    this.code = options.code || 'CONTROL_PLANE_ERROR';
    this.requestId = options.requestId;
    // Ensure safeMessage contains no authorization tokens or gateway secrets
    this.safeMessage = redactSensitiveStrings(message);
    if (options.cause) {
      this.cause = options.cause;
    }
  }
}

export class LioranDBAuthenticationError extends LioranDBAdminError {
  constructor(message = 'Control plane bearer token authentication failed (HTTP 401)', options?: { requestId?: string; cause?: unknown }) {
    super(message, { statusCode: 401, code: 'UNAUTHORIZED_CONTROL_PLANE', ...options });
    this.name = 'LioranDBAuthenticationError';
  }
}

export class LioranDBForbiddenError extends LioranDBAdminError {
  constructor(message = 'Management gateway authentication or authorization failed (HTTP 403)', options?: { requestId?: string; cause?: unknown }) {
    super(message, { statusCode: 403, code: 'FORBIDDEN_GATEWAY_OR_ROLE', ...options });
    this.name = 'LioranDBForbiddenError';
  }
}

export class LioranDBConfigurationError extends LioranDBAdminError {
  constructor(message = 'Server configuration error: Management gateway token missing', options?: { requestId?: string; cause?: unknown }) {
    super(message, { statusCode: 500, code: 'GATEWAY_CONFIGURATION_ERROR', ...options });
    this.name = 'LioranDBConfigurationError';
  }
}

export class LioranDBTimeoutError extends LioranDBAdminError {
  constructor(message = 'Control plane server request timed out', options?: { requestId?: string; cause?: unknown }) {
    super(message, { statusCode: 504, code: 'CONTROL_PLANE_TIMEOUT', ...options });
    this.name = 'LioranDBTimeoutError';
  }
}

export class LioranDBNotFoundError extends LioranDBAdminError {
  constructor(message = 'Resource not found on LioranDB server', options?: { requestId?: string; cause?: unknown }) {
    super(message, { statusCode: 404, code: 'NOT_FOUND', ...options });
    this.name = 'LioranDBNotFoundError';
  }
}

export class LioranDBConflictError extends LioranDBAdminError {
  constructor(message = 'Resource conflict on LioranDB server', options?: { requestId?: string; cause?: unknown }) {
    super(message, { statusCode: 409, code: 'CONFLICT', ...options });
    this.name = 'LioranDBConflictError';
  }
}

export class LioranDBResetError extends LioranDBAdminError {
  constructor(
    message = 'Failed to reset instance engine state',
    options?: { statusCode?: number; code?: string; requestId?: string; cause?: unknown }
  ) {
    super(message, { statusCode: options?.statusCode || 500, code: options?.code || 'RESET_FAILED', ...options });
    this.name = 'LioranDBResetError';
  }
}

export class LioranDBUnreachableError extends LioranDBAdminError {
  constructor(message = 'LioranDB server is unreachable', options?: { requestId?: string; cause?: unknown }) {
    super(message, { statusCode: 503, code: 'SERVER_UNREACHABLE', ...options });
    this.name = 'LioranDBUnreachableError';
  }
}

export function sanitizeErrorForLog(err: unknown): Record<string, unknown> {
  if (err instanceof LioranDBAdminError) {
    return {
      name: err.name,
      message: err.safeMessage,
      code: err.code,
      statusCode: err.statusCode,
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
