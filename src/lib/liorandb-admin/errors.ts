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
    super(message);
    this.name = 'LioranDBAdminError';
    this.statusCode = options.statusCode || 500;
    this.code = options.code || 'CONTROL_PLANE_ERROR';
    this.requestId = options.requestId;
    // Ensure safeMessage contains no authorization tokens or sensitive values
    this.safeMessage = message.replace(/Bearer\s+[a-zA-Z0-9_\-.]+/gi, 'Bearer [REDACTED]');
    if (options.cause) {
      this.cause = options.cause;
    }
  }
}

export class LioranDBAuthenticationError extends LioranDBAdminError {
  constructor(message = 'Control plane authentication failed', options?: { requestId?: string; cause?: unknown }) {
    super(message, { statusCode: 401, code: 'UNAUTHORIZED_CONTROL_PLANE', ...options });
    this.name = 'LioranDBAuthenticationError';
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
      message: err.message.replace(/Bearer\s+[a-zA-Z0-9_\-.]+/gi, 'Bearer [REDACTED]'),
    };
  }
  return { error: String(err) };
}
