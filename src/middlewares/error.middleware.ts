import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import jwt from 'jsonwebtoken';
import logger from '../observability/logging/index.js';
import config from '../config/index.js';
import ErrorResponse from '../utils/ErrorResponse.js';

/**
 * Global Error Handler Middleware
 *
 * Centralized error handling for consistent error responses across the service.
 * Handles various error types and formats them into standard API responses.
 */

interface ErrorWithCode extends Error {
  code?: string;
  statusCode?: number;
  details?: any;
  isOperational?: boolean;
}

/**
 * Main error handling middleware
 */
export const globalErrorHandler = (err: ErrorWithCode, req: Request, res: Response, _next: NextFunction): void => {
  // Generate unique error ID for tracking
  const errorId = generateErrorId();

  // Log error details
  logError(err, req, errorId);

  // Don't expose sensitive information in production
  const isDevelopment = config.server.env === 'development';

  const error = { ...err };
  error.message = err.message;

  // Handle specific error types
  if (err instanceof ErrorResponse) {
    // Custom ErrorResponse - already formatted
    sendErrorResponse(res, err.statusCode, err.toJSON().error, errorId);
    return;
  }

  // Zod Validation Errors
  if (err instanceof ZodError) {
    const validationErrors = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
      code: e.code,
    }));

    sendErrorResponse(
      res,
      422,
      {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: validationErrors,
        timestamp: new Date().toISOString(),
      },
      errorId
    );
    return;
  }

  // JWT Errors
  if (err instanceof jwt.TokenExpiredError) {
    sendErrorResponse(
      res,
      401,
      {
        code: 'TOKEN_EXPIRED',
        message: 'Authentication token has expired',
        timestamp: new Date().toISOString(),
      },
      errorId
    );
    return;
  }

  if (err instanceof jwt.JsonWebTokenError) {
    sendErrorResponse(
      res,
      401,
      {
        code: 'INVALID_TOKEN',
        message: 'Invalid authentication token',
        timestamp: new Date().toISOString(),
      },
      errorId
    );
    return;
  }

  // MongoDB/Database Errors
  if (err.name === 'CastError') {
    sendErrorResponse(
      res,
      400,
      {
        code: 'INVALID_ID',
        message: 'Invalid resource ID format',
        timestamp: new Date().toISOString(),
      },
      errorId
    );
    return;
  }

  if ((err as any).code === 11000) {
    // MongoDB duplicate key error
    const field = Object.keys((err as any).keyValue || {})[0] || 'field';
    sendErrorResponse(
      res,
      409,
      {
        code: 'DUPLICATE_RESOURCE',
        message: `Duplicate value for ${field}`,
        details: { field },
        timestamp: new Date().toISOString(),
      },
      errorId
    );
    return;
  }

  // RabbitMQ/AMQP Errors
  if (err.message?.includes('ECONNREFUSED') && err.message?.includes('5672')) {
    sendErrorResponse(
      res,
      503,
      {
        code: 'QUEUE_SERVICE_UNAVAILABLE',
        message: 'Message queue service is temporarily unavailable',
        timestamp: new Date().toISOString(),
      },
      errorId
    );
    return;
  }

  // MySQL/Database Connection Errors
  if ((err as any).code === 'ECONNREFUSED' || (err as any).code === 'ENOTFOUND') {
    sendErrorResponse(
      res,
      503,
      {
        code: 'DATABASE_UNAVAILABLE',
        message: 'Database service is temporarily unavailable',
        timestamp: new Date().toISOString(),
      },
      errorId
    );
    return;
  }

  // Email Service Errors
  if (err.message?.includes('SMTP') || err.message?.includes('nodemailer')) {
    sendErrorResponse(
      res,
      503,
      {
        code: 'EMAIL_SERVICE_UNAVAILABLE',
        message: 'Email service is temporarily unavailable',
        timestamp: new Date().toISOString(),
      },
      errorId
    );
    return;
  }

  // Default to internal server error
  const statusCode = err.statusCode || 500;
  const message = isDevelopment ? err.message : statusCode >= 500 ? 'Internal server error' : err.message;

  sendErrorResponse(
    res,
    statusCode,
    {
      code: err.code || 'INTERNAL_ERROR',
      message,
      details: isDevelopment
        ? {
            stack: err.stack,
            originalError: err.name,
          }
        : undefined,
      timestamp: new Date().toISOString(),
    },
    errorId
  );
};

/**
 * Send standardized error response
 */
function sendErrorResponse(res: Response, statusCode: number, error: any, errorId: string): void {
  res.status(statusCode).json({
    success: false,
    error: {
      ...error,
      errorId,
    },
  });
}

/**
 * Log error with context
 */
function logError(err: ErrorWithCode, req: Request, errorId: string): void {
  // Environment-based stack trace logging
  const isDevelopment = config.server.env === 'development';

  const logData = {
    errorId,
    message: err.message,
    stack: isDevelopment ? err.stack : 'Stack trace hidden in production',
    statusCode: err.statusCode,
    code: err.code,
    method: req.method,
    path: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: (req as any).user?.id,
    timestamp: new Date().toISOString(),
  };

  // Log as error for 5xx, warn for 4xx, info for others
  if ((err.statusCode || 500) >= 500) {
    logger.error('Server Error:', logData);
  } else if ((err.statusCode || 500) >= 400) {
    logger.warn('Client Error:', logData);
  } else {
    logger.info('Request Error:', logData);
  }
}

/**
 * Generate unique error ID for tracking
 */
function generateErrorId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `err_${timestamp}_${random}`;
}

/**
 * Handle 404 errors for unknown routes
 */
export const notFoundHandler = (req: Request, res: Response): void => {
  const error = ErrorResponse.notFound(`Route ${req.originalUrl} not found`);

  logger.warn('Route not found:', {
    method: req.method,
    path: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  res.status(404).json(error.toJSON());
};

/**
 * Handle uncaught exceptions
 */
export const handleUncaughtException = (err: Error): void => {
  logger.error('Uncaught Exception - shutting down gracefully:', {
    message: err.message,
    stack: err.stack,
    timestamp: new Date().toISOString(),
  });

  process.exit(1);
};

/**
 * Handle unhandled promise rejections
 */
export const handleUnhandledRejection = (reason: unknown, _promise: Promise<unknown>): void => {
  logger.error('Unhandled Promise Rejection - shutting down gracefully:', {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
    timestamp: new Date().toISOString(),
  });

  process.exit(1);
};

export default globalErrorHandler;
