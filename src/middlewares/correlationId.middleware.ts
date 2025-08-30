import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export interface RequestWithCorrelationId extends Request {
  correlationId?: string;
}

/**
 * Correlation ID middleware for distributed tracing
 * Extracts correlation ID from X-Correlation-ID header or generates a new one
 */
export const correlationIdMiddleware = (req: RequestWithCorrelationId, res: Response, next: NextFunction): void => {
  // Extract correlation ID from header or generate new one
  const correlationId =
    (req.headers['x-correlation-id'] as string) || (req.headers['X-Correlation-ID'] as string) || uuidv4();

  // Add correlation ID to request object
  req.correlationId = correlationId;

  // Add correlation ID to response headers
  res.setHeader('X-Correlation-ID', correlationId);

  // Add to response locals for template access if needed
  res.locals.correlationId = correlationId;

  // Log the request with correlation ID
  console.log(`[${correlationId}] ${req.method} ${req.path} - Processing request`);

  next();
};

/**
 * Utility functions for correlation ID handling
 */
export class CorrelationIdHelper {
  /**
   * Get correlation ID from request
   */
  static getCorrelationId(req: RequestWithCorrelationId): string {
    return req.correlationId || 'unknown';
  }

  /**
   * Create headers with correlation ID for outgoing HTTP requests
   */
  static createHeaders(
    req: RequestWithCorrelationId,
    additionalHeaders?: Record<string, string>
  ): Record<string, string> {
    const correlationId = this.getCorrelationId(req);

    return {
      'X-Correlation-ID': correlationId,
      'Content-Type': 'application/json',
      ...additionalHeaders,
    };
  }

  /**
   * Log with correlation ID context
   */
  static log(
    req: RequestWithCorrelationId,
    level: 'info' | 'error' | 'warn' | 'debug',
    message: string,
    meta?: Record<string, any>
  ): void {
    const correlationId = this.getCorrelationId(req);
    const logData = {
      correlationId,
      message,
      timestamp: new Date().toISOString(),
      ...meta,
    };

    console[level](`[${correlationId}] ${message}`, logData);
  }

  /**
   * Create correlation ID context for async operations
   */
  static withCorrelationId<T>(
    req: RequestWithCorrelationId,
    operation: (correlationId: string) => Promise<T>
  ): Promise<T> {
    const correlationId = this.getCorrelationId(req);
    return operation(correlationId);
  }
}
