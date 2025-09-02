import Logger from '../observability/logging/logger.js';

// Create and export the logger instance with proper configuration
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

// Export default logger
export default logger;
