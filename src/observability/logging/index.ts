/**
 * Unified logging exports for notification-service
 */

export { default as Logger } from './logger.js';
export { LOG_LEVELS, ENVIRONMENT_CONFIGS, DEFAULT_CONFIG } from './schemas.js';
export type { LoggerConfig, StandardLogEntry } from './schemas.js';
export { createJsonFormat, createConsoleFormat, createUnifiedLogEntry } from './formatters.js';

import Logger from './logger.js';

// Create and export the configured logger instance for the notification service
export const logger = new Logger({
  serviceName: 'notification-service',
  version: '1.0.0',
  enableConsole: true,
  enableFile: true,
  logLevel: 'INFO',
  format: 'json',
  enableTracing: true,
  filePath: './logs/notification-service.log',
});

// Create a stream object with a 'write' function that will be used by morgan
export const morganStream = {
  write: (message: string) => {
    logger.info(message.trim()); // Use info instead of http since Logger doesn't have http method
  },
};

// Export logger as default for backward compatibility
export default logger;
