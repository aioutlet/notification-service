/**
 * Observability exports for notification-service
 */

// Logging exports
export { Logger, LOG_LEVELS, ENVIRONMENT_CONFIGS, DEFAULT_CONFIG } from './logging/index.js';
export type { LoggerConfig, StandardLogEntry } from './logging/index.js';

// Tracing exports
export {
  initializeTracing,
  shutdownTracing,
  isTracingEnabled,
  getServiceInfo,
  getTracingContext,
  createOperationSpan,
} from './tracing/index.js';
