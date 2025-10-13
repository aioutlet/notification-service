/**
 * Unified logging schema for notification-service
 * This file defines the standard log entry format and validation
 */

/**
 * Log levels with their priority values
 */
export const LOG_LEVELS = {
  FATAL: { value: 5, color: 'red' },
  ERROR: { value: 4, color: 'red' },
  WARN: { value: 3, color: 'yellow' },
  INFO: { value: 2, color: 'green' },
  DEBUG: { value: 1, color: 'blue' },
} as const;

/**
 * Configuration interface for the logger
 */
export interface LoggerConfig {
  serviceName: string;
  version: string;
  environment: string;
  enableConsole: boolean;
  enableFile: boolean;
  logLevel: keyof typeof LOG_LEVELS;
  format: 'json' | 'console';
  enableTracing: boolean;
  filePath?: string;
}

/**
 * Standard log entry interface
 */
export interface StandardLogEntry {
  timestamp: string;
  level: string;
  service: string;
  version: string;
  environment: string;
  correlationId?: string | null;
  traceId?: string | null;
  spanId?: string | null;
  message: string;
  operation?: string | null;
  duration?: number | null;
  userId?: string | null;
  businessEvent?: string | null;
  securityEvent?: string | null;
  error?: {
    name: string;
    message: string;
    stack?: string;
  } | null;
  metadata?: Record<string, any> | null;
}

/**
 * Default logger configuration
 */
export const DEFAULT_CONFIG: LoggerConfig = {
  serviceName: 'notification-service',
  version: '1.0.0',
  environment: 'development',
  logLevel: 'INFO',
  format: 'json',
  enableConsole: true,
  enableFile: false,
  enableTracing: false,
};

/**
 * Environment-specific configurations
 */
export const ENVIRONMENT_CONFIGS: Record<string, LoggerConfig> = {
  local: {
    ...DEFAULT_CONFIG,
    logLevel: 'DEBUG',
    format: 'console',
    enableFile: true,
    enableTracing: true,
  },
  development: {
    ...DEFAULT_CONFIG,
    logLevel: 'DEBUG',
    format: 'json',
    enableFile: true,
    enableTracing: true,
  },
  staging: {
    ...DEFAULT_CONFIG,
    logLevel: 'INFO',
    format: 'json',
    enableFile: true,
    enableTracing: true,
  },
  production: {
    ...DEFAULT_CONFIG,
    logLevel: 'INFO',
    format: 'json',
    enableFile: true,
    enableTracing: true,
  },
  test: {
    ...DEFAULT_CONFIG,
    logLevel: 'ERROR',
    format: 'json',
    enableConsole: false,
    enableFile: false,
    enableTracing: false,
  },
};

/**
 * Create a base log entry with standard fields
 */
export function createBaseLogEntry(
  config: LoggerConfig,
  level: string,
  message: string,
  additionalFields: Partial<StandardLogEntry> = {}
): StandardLogEntry {
  return {
    timestamp: new Date().toISOString(),
    level: level.toUpperCase(),
    service: config.serviceName,
    version: config.version,
    environment: config.environment,
    message,
    ...additionalFields,
  };
}

/**
 * Validate log entry against the standard schema
 */
export function validateLogEntry(entry: StandardLogEntry): boolean {
  const requiredFields = ['timestamp', 'level', 'service', 'version', 'environment', 'message'];

  for (const field of requiredFields) {
    if (!(field in entry) || entry[field as keyof StandardLogEntry] === undefined) {
      return false;
    }
  }

  return true;
}
