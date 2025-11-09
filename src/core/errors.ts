/**
 * Custom Error Classes
 * Provides standardized error handling for notification-service
 */

export class ErrorResponse extends Error {
  statusCode: number;
  status: number;
  code: string | null;

  constructor(message: string, statusCode: number, code: string | null = null) {
    super(message);
    this.statusCode = statusCode;
    this.status = statusCode;
    this.code = code;
    this.name = 'ErrorResponse';

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ErrorResponse);
    }
  }
}

export class ValidationError extends ErrorResponse {
  constructor(message: string, code: string | null = null) {
    super(message, 400, code || 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends ErrorResponse {
  constructor(message: string, code: string | null = null) {
    super(message, 404, code || 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends ErrorResponse {
  constructor(message: string, code: string | null = null) {
    super(message, 401, code || 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends ErrorResponse {
  constructor(message: string, code: string | null = null) {
    super(message, 403, code || 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

export class ConflictError extends ErrorResponse {
  constructor(message: string, code: string | null = null) {
    super(message, 409, code || 'CONFLICT');
    this.name = 'ConflictError';
  }
}

export class InternalServerError extends ErrorResponse {
  constructor(message: string, code: string | null = null) {
    super(message, 500, code || 'INTERNAL_SERVER_ERROR');
    this.name = 'InternalServerError';
  }
}

export default ErrorResponse;
