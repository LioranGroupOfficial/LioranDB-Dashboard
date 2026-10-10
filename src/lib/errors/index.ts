export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
    this.name = 'ConflictError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 403, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

export class AccountVerificationRequiredError extends AppError {
  public redirectTo = '/verify-account';
  constructor(message = 'Complete the one-time ₹30 account verification payment.') {
    super(message, 403, 'ACCOUNT_VERIFICATION_REQUIRED');
    this.name = 'AccountVerificationRequiredError';
  }
}

import { LioranDBAdminError } from '@/lib/liorandb-admin/errors';
import { LioranDriverError, DRIVER_ERROR_CODES } from '@liorandb/driver';

export function createApiError(error: unknown): Response {
  if (error instanceof AccountVerificationRequiredError) {
    return Response.json(
      {
        error: error.code,
        message: error.message,
        redirectTo: error.redirectTo,
      },
      { status: error.statusCode }
    );
  }
  if (error instanceof LioranDBAdminError) {
    return Response.json(
      { error: error.safeMessage, code: error.code, requestId: error.requestId },
      { status: error.statusCode }
    );
  }
  if (error instanceof AppError) {
    return Response.json(
      { error: error.message, code: error.code },
      { status: error.statusCode }
    );
  }

  // Handle LioranDB driver runtime errors with safe status codes and messages
  if (error instanceof LioranDriverError || (error && typeof error === 'object' && 'category' in error)) {
    const driverErr = error as LioranDriverError;
    const category = driverErr.category;
    const code = driverErr.code;

    if (category === 'conflict' || code === DRIVER_ERROR_CODES.DUPLICATE_KEY || code === DRIVER_ERROR_CODES.CONFLICT) {
      return Response.json(
        { error: 'Conflict', message: 'A record with this unique identifier already exists.', code: 'DUPLICATE_KEY' },
        { status: 409 }
      );
    }

    if (category === 'authentication' || code === DRIVER_ERROR_CODES.AUTH_INVALID_CREDENTIALS || code === DRIVER_ERROR_CODES.AUTH_REQUIRED) {
      return Response.json(
        { error: 'AuthenticationFailed', message: 'Database authentication failed.', code: 'AUTH_FAILED' },
        { status: 401 }
      );
    }

    if (category === 'authorization' || code === DRIVER_ERROR_CODES.PERMISSION_DENIED) {
      return Response.json(
        { error: 'Forbidden', message: 'Permission denied on database operation.', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    if (category === 'network' || category === 'server-unavailable' || code === DRIVER_ERROR_CODES.CONNECTION_REFUSED) {
      return Response.json(
        { error: 'DatabaseUnavailable', message: 'Database service is currently unavailable. Please try again.', code: 'DATABASE_UNAVAILABLE' },
        { status: 503 }
      );
    }

    if (category === 'timeout' || code === DRIVER_ERROR_CODES.REQUEST_TIMEOUT) {
      return Response.json(
        { error: 'DatabaseTimeout', message: 'Database operation timed out. Please try again.', code: 'TIMEOUT' },
        { status: 504 }
      );
    }

    if (category === 'validation' || code === DRIVER_ERROR_CODES.VALIDATION_FAILED) {
      return Response.json(
        { error: 'ValidationError', message: driverErr.message, code: 'VALIDATION_FAILED' },
        { status: 400 }
      );
    }

    console.error('[LioranDB Driver Error]', driverErr.toDiagnosticString?.() || driverErr.message);
    return Response.json(
      { error: 'DatabaseError', message: 'A persistent database error occurred.', code: driverErr.code },
      { status: 500 }
    );
  }

  const message =
    process.env.NODE_ENV === 'development' && error instanceof Error
      ? error.message
      : 'An unexpected error occurred';
  console.error('[API Error]', error);
  return Response.json({ error: message }, { status: 500 });
}

export function createActionError(error: unknown): { error: string } {
  if (error instanceof AppError) {
    return { error: error.message };
  }
  if (error instanceof LioranDriverError) {
    if (error.category === 'conflict' || error.code === DRIVER_ERROR_CODES.DUPLICATE_KEY) {
      return { error: 'An account or record with this unique identifier already exists.' };
    }
    if (error.category === 'network' || error.category === 'server-unavailable') {
      return { error: 'Database service is currently unavailable. Please try again.' };
    }
  }
  console.error('[Action Error]', error);
  return { error: 'An unexpected error occurred. Please try again.' };
}
