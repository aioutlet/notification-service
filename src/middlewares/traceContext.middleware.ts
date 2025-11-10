/**
 * W3C Trace Context Middleware for Notification Service
 * Implements W3C Trace Context specification for distributed tracing
 * Specification: https://www.w3.org/TR/trace-context/
 */

import { Request, Response, NextFunction } from 'express';

export interface RequestWithTraceContext extends Request {
  traceId: string;
  spanId: string;
  correlationId?: string;
}

/**
 * Extract trace context from traceparent header
 * Format: version-traceId-spanId-flags (e.g., 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01)
 */
function extractTraceContext(traceparent: string): { traceId: string; spanId: string } | null {
  const parts = traceparent.split('-');

  // Valid format: 00-{32-hex-trace-id}-{16-hex-span-id}-{2-hex-flags}
  if (parts.length !== 4 || parts[0] !== '00') {
    return null;
  }

  const traceId = parts[1];
  const spanId = parts[2];

  // Validate trace ID (32 hex chars, not all zeros)
  if (!/^[0-9a-f]{32}$/.test(traceId) || traceId === '00000000000000000000000000000000') {
    return null;
  }

  // Validate span ID (16 hex chars, not all zeros)
  if (!/^[0-9a-f]{16}$/.test(spanId) || spanId === '0000000000000000') {
    return null;
  }

  return { traceId, spanId };
}

/**
 * Generate new trace context IDs
 */
function generateTraceContext(): { traceId: string; spanId: string } {
  const traceId = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

  const spanId = Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

  return { traceId, spanId };
}

/**
 * Middleware to extract or generate W3C Trace Context
 */
export const traceContextMiddleware = (req: RequestWithTraceContext, res: Response, next: NextFunction): void => {
  // Try to extract from traceparent header
  const traceparent = req.headers['traceparent'] as string;
  let traceContext = traceparent ? extractTraceContext(traceparent) : null;

  // Generate new context if extraction failed or no header present
  if (!traceContext) {
    traceContext = generateTraceContext();
  }

  // Attach to request
  req.traceId = traceContext.traceId;
  req.spanId = traceContext.spanId;

  // Support legacy correlation-id header for backward compatibility
  req.correlationId = (req.headers['x-correlation-id'] as string) || req.traceId;

  // Add traceparent to response headers for propagation
  res.setHeader('traceparent', `00-${traceContext.traceId}-${traceContext.spanId}-01`);

  // Also expose as X-Trace-ID for easier debugging
  res.setHeader('X-Trace-ID', traceContext.traceId);

  next();
};

/**
 * Helper to create traceparent header for outgoing requests
 */
export function createTraceparentHeader(traceId: string, spanId?: string): string {
  const actualSpanId = spanId || Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

  return `00-${traceId}-${actualSpanId}-01`;
}
