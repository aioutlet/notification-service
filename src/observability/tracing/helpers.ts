import { trace } from '@opentelemetry/api';
import { isTracingEnabled } from './setup.js';

/**
 * Tracing helper functions
 */

/**
 * Get service information from environment variables
 * @returns Object containing serviceName and serviceVersion
 */
export function getServiceInfo(): { serviceName: string; serviceVersion: string } {
  return {
    serviceName: process.env.NAME || process.env.OTEL_SERVICE_NAME || 'notification-service',
    serviceVersion: process.env.VERSION || process.env.OTEL_SERVICE_VERSION || '1.0.0',
  };
}

/**
 * Get current trace and span IDs from OpenTelemetry context
 * @returns Object containing traceId and spanId
 */
export function getTracingContext(): { traceId: string | null; spanId: string | null } {
  if (!isTracingEnabled()) {
    return { traceId: null, spanId: null };
  }

  try {
    const span = trace.getActiveSpan();
    if (!span) {
      return { traceId: null, spanId: null };
    }

    const spanContext = span.spanContext();
    return {
      traceId: spanContext.traceId || null,
      spanId: spanContext.spanId || null,
    };
  } catch (error) {
    // If OpenTelemetry is not properly initialized, return nulls
    console.debug('Failed to get tracing context:', (error as Error).message);
    return { traceId: null, spanId: null };
  }
}

/**
 * Create a new span for operation tracking
 * @param operationName - Name of the operation
 * @param attributes - Additional attributes for the span
 * @returns Span object with context
 */
export function createOperationSpan(
  operationName: string,
  attributes: Record<string, any> = {}
): {
  span: any;
  traceId: string | null;
  spanId: string | null;
  end: () => void;
  setStatus: (code: any, message?: string) => void;
  addEvent: (name: string, attributes?: Record<string, any>) => void;
} {
  if (!isTracingEnabled()) {
    return {
      span: null,
      traceId: null,
      spanId: null,
      end: () => {},
      setStatus: () => {},
      addEvent: () => {},
    };
  }

  try {
    const { serviceName, serviceVersion } = getServiceInfo();

    const tracer = trace.getTracer(serviceName, serviceVersion);
    const span = tracer.startSpan(operationName, {
      attributes: {
        'service.name': serviceName,
        'service.version': serviceVersion,
        ...attributes,
      },
    });

    return {
      span,
      traceId: span.spanContext().traceId,
      spanId: span.spanContext().spanId,
      end: () => span.end(),
      setStatus: (code, message) => span.setStatus({ code, message }),
      addEvent: (name, attributes) => span.addEvent(name, attributes),
    };
  } catch (error) {
    // Return a no-op span if tracing fails
    console.debug('Failed to create operation span:', (error as Error).message);
    return {
      span: null,
      traceId: null,
      spanId: null,
      end: () => {},
      setStatus: () => {},
      addEvent: () => {},
    };
  }
}
