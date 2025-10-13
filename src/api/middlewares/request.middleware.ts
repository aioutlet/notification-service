import { Request, Response, NextFunction } from 'express';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import Logger from '../shared/observability/logging/logger.js';
import { RequestWithCorrelationId } from './correlationId.middleware.js';

// Create logger instance
const logger = new Logger();

/**
 * Request logging middleware for distributed tracing and audit trail
 * Logs all incoming HTTP requests with correlation ID, trace ID, and span ID
 */
export const requestLoggingMiddleware = (req: RequestWithCorrelationId, res: Response, next: NextFunction): void => {
  const startTime = Date.now();
  const span = trace.getActiveSpan();

  // Log incoming request
  logger.info('HTTP Request Started', {
    method: req.method,
    url: req.url,
    path: req.path,
    query: req.query,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    contentLength: req.get('Content-Length'),
    correlationId: req.correlationId,
    traceId: span?.spanContext().traceId,
    spanId: span?.spanContext().spanId,
  });

  // Override res.json to capture response data
  const originalJson = res.json;
  res.json = function (body: any): Response {
    const duration = Date.now() - startTime;

    // Log response
    logger.info('HTTP Request Completed', {
      method: req.method,
      url: req.url,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      responseSize: JSON.stringify(body || {}).length,
      correlationId: req.correlationId,
      traceId: span?.spanContext().traceId,
      spanId: span?.spanContext().spanId,
    });

    // Set span status based on HTTP status code
    if (span) {
      if (res.statusCode >= 400) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: `HTTP ${res.statusCode}`,
        });
      } else {
        span.setStatus({ code: SpanStatusCode.OK });
      }

      // Add HTTP attributes to span
      span.setAttributes({
        'http.method': req.method,
        'http.url': req.url,
        'http.status_code': res.statusCode,
        'http.response_size': JSON.stringify(body || {}).length,
        duration_ms: duration,
      });
    }

    return originalJson.call(this, body);
  };

  // Handle response end for requests that don't use res.json
  res.on('finish', () => {
    if (!res.headersSent) {
      return; // Already logged in res.json override
    }

    const duration = Date.now() - startTime;

    logger.info('HTTP Request Finished', {
      method: req.method,
      url: req.url,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      correlationId: req.correlationId,
      traceId: span?.spanContext().traceId,
      spanId: span?.spanContext().spanId,
    });

    // Set span status
    if (span) {
      if (res.statusCode >= 400) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: `HTTP ${res.statusCode}`,
        });
      } else {
        span.setStatus({ code: SpanStatusCode.OK });
      }

      span.setAttributes({
        'http.method': req.method,
        'http.url': req.url,
        'http.status_code': res.statusCode,
        duration_ms: duration,
      });
    }
  });

  // Handle errors
  res.on('error', (error: Error) => {
    const duration = Date.now() - startTime;

    logger.error('HTTP Request Error', {
      method: req.method,
      url: req.url,
      path: req.path,
      error: error.message,
      stack: error.stack,
      duration: `${duration}ms`,
      correlationId: req.correlationId,
      traceId: span?.spanContext().traceId,
      spanId: span?.spanContext().spanId,
    });

    if (span) {
      span.recordException(error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
    }
  });

  next();
};

/**
 * Error handling middleware for uncaught errors
 */
export const errorLoggingMiddleware = (
  error: Error,
  req: RequestWithCorrelationId,
  res: Response,
  next: NextFunction
): void => {
  const span = trace.getActiveSpan();

  logger.error('Unhandled Error', {
    method: req.method,
    url: req.url,
    path: req.path,
    error: error.message,
    stack: error.stack,
    correlationId: req.correlationId,
    traceId: span?.spanContext().traceId,
    spanId: span?.spanContext().spanId,
  });

  if (span) {
    span.recordException(error);
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message,
    });
  }

  // Send error response
  if (!res.headersSent) {
    res.status(500).json({
      error: 'Internal Server Error',
      correlationId: req.correlationId,
      timestamp: new Date().toISOString(),
    });
  }

  next(error);
};
