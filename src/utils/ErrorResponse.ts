/**
 * Custom Error Response Class
 *
 * Enhanced error class that provides structured error information
 * for consistent error handling across the notification service.
 */
class ErrorResponse extends Error {
  public statusCode: number;
  public code: string;
  public details?: any;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 500, code: string = 'INTERNAL_ERROR', details?: any) {
    super(message);

    this.name = 'ErrorResponse';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true; // Mark as operational (expected) error

    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert error to JSON for API responses
   */
  toJSON() {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        statusCode: this.statusCode,
        details: this.details,
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Static factory methods for common errors
   */
  static badRequest(message: string, details?: any) {
    return new ErrorResponse(message, 400, 'BAD_REQUEST', details);
  }

  static unauthorized(message: string = 'Authentication required') {
    return new ErrorResponse(message, 401, 'UNAUTHORIZED');
  }

  static forbidden(message: string = 'Access denied') {
    return new ErrorResponse(message, 403, 'FORBIDDEN');
  }

  static notFound(message: string = 'Resource not found') {
    return new ErrorResponse(message, 404, 'NOT_FOUND');
  }

  static conflict(message: string, details?: any) {
    return new ErrorResponse(message, 409, 'CONFLICT', details);
  }

  static validation(message: string, details?: any) {
    return new ErrorResponse(message, 422, 'VALIDATION_ERROR', details);
  }

  static tooManyRequests(message: string = 'Rate limit exceeded') {
    return new ErrorResponse(message, 429, 'RATE_LIMIT_EXCEEDED');
  }

  static internal(message: string = 'Internal server error', details?: any) {
    return new ErrorResponse(message, 500, 'INTERNAL_ERROR', details);
  }

  static serviceUnavailable(message: string = 'Service temporarily unavailable') {
    return new ErrorResponse(message, 503, 'SERVICE_UNAVAILABLE');
  }
}

export default ErrorResponse;
