/**
 * OpenTelemetry tracing exports for notification-service
 */

export { initializeTracing, shutdownTracing, isTracingEnabled } from './setup.js';
export { getServiceInfo, getTracingContext, createOperationSpan } from './helpers.js';
