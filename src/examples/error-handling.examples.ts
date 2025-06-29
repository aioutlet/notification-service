// Demo: Error Handling Examples
// This file demonstrates the new error handling capabilities

import ErrorResponse from '../utils/ErrorResponse';

/**
 * Example controller showing various error types
 */
export const errorExamples = {
  // Bad Request (400)
  badRequest: () => {
    throw ErrorResponse.badRequest('Invalid email format', {
      field: 'email',
      provided: 'invalid-email',
    });
  },

  // Unauthorized (401)
  unauthorized: () => {
    throw ErrorResponse.unauthorized('JWT token required');
  },

  // Forbidden (403)
  forbidden: () => {
    throw ErrorResponse.forbidden('Admin access required');
  },

  // Not Found (404)
  notFound: () => {
    throw ErrorResponse.notFound('User not found');
  },

  // Validation Error (422)
  validation: () => {
    throw ErrorResponse.validation('Validation failed', {
      errors: [
        { field: 'email', message: 'Email is required' },
        { field: 'password', message: 'Password too weak' },
      ],
    });
  },

  // Rate Limit (429)
  rateLimit: () => {
    throw ErrorResponse.tooManyRequests('Too many requests. Try again in 1 minute');
  },

  // Internal Server Error (500)
  internal: () => {
    throw ErrorResponse.internal('Database connection failed');
  },

  // Service Unavailable (503)
  serviceUnavailable: () => {
    throw ErrorResponse.serviceUnavailable('Email service is down for maintenance');
  },
};

/**
 * Example JSON responses that the error handler will generate:
 */

// BadRequest example:
const badRequestExample = {
  success: false,
  error: {
    code: 'BAD_REQUEST',
    message: 'Invalid email format',
    statusCode: 400,
    details: {
      field: 'email',
      provided: 'invalid-email',
    },
    timestamp: '2025-06-29T11:30:45.123Z',
    errorId: 'err_abc123_def456',
  },
};

// Validation error example:
const validationExample = {
  success: false,
  error: {
    code: 'VALIDATION_ERROR',
    message: 'Request validation failed',
    statusCode: 422,
    details: [
      {
        field: 'email',
        message: 'Invalid email',
        code: 'invalid_string',
      },
    ],
    timestamp: '2025-06-29T11:30:45.123Z',
    errorId: 'err_xyz789_uvw012',
  },
};

// Internal error example (production):
const internalErrorExample = {
  success: false,
  error: {
    code: 'INTERNAL_ERROR',
    message: 'Internal server error',
    statusCode: 500,
    timestamp: '2025-06-29T11:30:45.123Z',
    errorId: 'err_mno345_pqr678',
  },
};

export { badRequestExample, validationExample, internalErrorExample };
