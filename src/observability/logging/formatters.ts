import winston from 'winston';
import { LoggerConfig, StandardLogEntry, createBaseLogEntry } from './schemas.js';
import { getTracingContext } from '../tracing/helpers.js';

/**
 * Log formatters for different output types
 */

/**
 * Create unified log entry from Winston info object
 * @param config - Logger configuration
 * @param info - Winston info object
 * @returns Unified log entry
 */
export function createUnifiedLogEntry(config: LoggerConfig, info: any): StandardLogEntry {
  // Get tracing context if enabled
  const tracingContext = config.enableTracing ? getTracingContext() : { traceId: null, spanId: null };

  // Create base entry
  const entry = createBaseLogEntry(config, info.level, info.message, {
    ...tracingContext,
    correlationId: info.correlationId || null,
    operation: info.operation || null,
    duration: info.duration || null,
    userId: info.userId || null,
    businessEvent: info.businessEvent || null,
    securityEvent: info.securityEvent || null,
    error: info.error || null,
    metadata: info.metadata || (hasExtraFields(info) ? extractMetadata(info) : null),
  });

  return entry;
}

/**
 * Check if info object has extra fields beyond standard ones
 * @param info - Winston info object
 * @returns True if has extra fields
 */
function hasExtraFields(info: any): boolean {
  const standardFields = [
    'level',
    'message',
    'timestamp',
    'correlationId',
    'operation',
    'duration',
    'userId',
    'businessEvent',
    'securityEvent',
    'error',
    'metadata',
  ];
  return Object.keys(info).some((key) => !standardFields.includes(key));
}

/**
 * Extract metadata from info object
 * @param info - Winston info object
 * @returns Extracted metadata or null
 */
function extractMetadata(info: any): Record<string, any> | null {
  const standardFields = [
    'level',
    'message',
    'timestamp',
    'correlationId',
    'operation',
    'duration',
    'userId',
    'businessEvent',
    'securityEvent',
    'error',
    'metadata',
  ];

  const metadata: Record<string, any> = {};
  Object.keys(info).forEach((key) => {
    if (!standardFields.includes(key)) {
      metadata[key] = info[key];
    }
  });

  return Object.keys(metadata).length > 0 ? metadata : null;
}

/**
 * Format message for console output
 * @param entry - Unified log entry
 * @returns Formatted console message
 */
export function formatConsoleMessage(entry: StandardLogEntry): string {
  const timestamp = entry.timestamp;
  const level = entry.level;
  const service = entry.service;
  const correlationId = entry.correlationId ? `[${entry.correlationId}]` : '[no-correlation]';
  const traceInfo = entry.traceId ? `[trace:${entry.traceId.substring(0, 8)}]` : '';

  let message = `[${timestamp}] [${level}] ${service} ${correlationId}${traceInfo}: ${entry.message}`;

  // Add contextual information
  const contextFields: string[] = [];
  if (entry.operation) {
    contextFields.push(`operation=${entry.operation}`);
  }
  if (entry.duration) {
    contextFields.push(`duration=${entry.duration}ms`);
  }
  if (entry.userId) {
    contextFields.push(`userId=${entry.userId}`);
  }
  if (entry.businessEvent) {
    contextFields.push(`businessEvent=${entry.businessEvent}`);
  }
  if (entry.securityEvent) {
    contextFields.push(`securityEvent=${entry.securityEvent}`);
  }

  if (contextFields.length > 0) {
    message += ` | ${contextFields.join(', ')}`;
  }

  // Add metadata
  if (entry.metadata) {
    const metaStr = Object.entries(entry.metadata)
      .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
      .join(', ');
    message += ` | metadata: ${metaStr}`;
  }

  // Add error information
  if (entry.error) {
    message += ` | ERROR: ${entry.error.name}: ${entry.error.message}`;
  }

  return message;
}

/**
 * Create JSON format for structured logging
 * @param config - Logger configuration
 * @returns Winston JSON format
 */
export function createJsonFormat(config: LoggerConfig): winston.Logform.Format {
  return winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf((info) => {
      const unifiedEntry = createUnifiedLogEntry(config, info);
      return JSON.stringify(unifiedEntry);
    })
  );
}

/**
 * Create console format for development
 * @param config - Logger configuration
 * @returns Winston console format
 */
export function createConsoleFormat(config: LoggerConfig): winston.Logform.Format {
  return winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf((info) => {
      const unifiedEntry = createUnifiedLogEntry(config, info);
      const message = formatConsoleMessage(unifiedEntry);

      // For TypeScript, we'll skip colorization and just return the message
      return message;
    })
  );
}
