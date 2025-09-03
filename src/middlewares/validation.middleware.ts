import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import logger from '../observability/logging/index.js';

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface StandardErrorResponse {
  success: false;
  message: string;
  errors?: ValidationError[];
  timestamp: string;
  path: string;
}

/**
 * Creates validation middleware for request body
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validatedData = schema.parse(req.body);
      req.body = validatedData; // Replace with validated/transformed data
      next();
    } catch (error) {
      handleValidationError(error, req, res, 'body');
    }
  };
}

/**
 * Creates validation middleware for query parameters
 */
export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validatedData = schema.parse(req.query);
      req.query = validatedData as any; // Replace with validated/transformed data
      next();
    } catch (error) {
      handleValidationError(error, req, res, 'query');
    }
  };
}

/**
 * Creates validation middleware for route parameters
 */
export function validateParams<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validatedData = schema.parse(req.params);
      req.params = validatedData as any; // Replace with validated/transformed data
      next();
    } catch (error) {
      handleValidationError(error, req, res, 'params');
    }
  };
}

/**
 * Handle validation errors and send standardized error response
 */
function handleValidationError(error: unknown, req: Request, res: Response, source: 'body' | 'query' | 'params'): void {
  if (error instanceof ZodError) {
    const validationErrors: ValidationError[] = error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
    }));

    const errorResponse: StandardErrorResponse = {
      success: false,
      message: `Validation failed for ${source}`,
      errors: validationErrors,
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
    };

    logger.warn('❌ Validation error:', {
      source,
      path: req.originalUrl,
      method: req.method,
      errors: validationErrors,
    });

    res.status(400).json(errorResponse);
  } else {
    // Handle unexpected errors
    logger.error('❌ Unexpected validation error:', error);

    const errorResponse: StandardErrorResponse = {
      success: false,
      message: 'Internal validation error',
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
    };

    res.status(500).json(errorResponse);
  }
}

/**
 * Creates a standardized success response
 */
export function createSuccessResponse<T>(message: string, data?: T, meta?: Record<string, any>) {
  return {
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
    ...meta,
  };
}

/**
 * Creates a standardized error response
 */
export function createErrorResponse(message: string, statusCode: number = 500, errors?: ValidationError[]) {
  return {
    response: {
      success: false,
      message,
      errors,
      timestamp: new Date().toISOString(),
    },
    statusCode,
  };
}
