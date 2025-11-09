/**
 * Logger for notification-service
 * Simple Winston-based logger with correlation ID support
 */
import winston from 'winston';

const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const IS_TEST = process.env.NODE_ENV === 'test';
const NAME = process.env.NAME || 'notification-service';
const LOG_FORMAT = process.env.LOG_FORMAT || (IS_PRODUCTION ? 'json' : 'console');

/**
 * Console formatter for development
 */
const consoleFormat = winston.format.printf(({ level, message, timestamp, traceId, ...meta }) => {
  const colors: Record<string, string> = {
    error: '\x1b[31m',
    warn: '\x1b[33m',
    info: '\x1b[32m',
    debug: '\x1b[34m',
  };
  const reset = '\x1b[0m';
  const color = colors[level] || '';

  // Show first 8 chars of traceId in console for readability
  const traceIdShort = traceId && typeof traceId === 'string' ? traceId.substring(0, 8) : 'no-trace';
  const traceInfo = `[trace:${traceIdShort}]`;
  const metaStr = Object.keys(meta).length > 0 ? ` | ${JSON.stringify(meta)}` : '';

  return `${color}[${timestamp}] [${level.toUpperCase()}] ${NAME} ${traceInfo}: ${message}${metaStr}${reset}`;
});

/**
 * JSON formatter for production
 */
const jsonFormat = winston.format.printf(({ level, message, timestamp, traceId, spanId, ...meta }) => {
  return JSON.stringify({
    timestamp,
    level,
    service: NAME,
    traceId: traceId || null,
    spanId: spanId || null,
    message,
    ...meta,
  });
});

/**
 * Create Winston logger
 */
const createWinstonLogger = () => {
  const transports: winston.transport[] = [];

  // Console transport
  if (!IS_TEST) {
    transports.push(
      new winston.transports.Console({
        format: winston.format.combine(winston.format.timestamp(), LOG_FORMAT === 'json' ? jsonFormat : consoleFormat),
      })
    );
  }

  // File transport
  if (process.env.LOG_TO_FILE === 'true') {
    transports.push(
      new winston.transports.File({
        filename: `./logs/${NAME}.log`,
        format: winston.format.combine(winston.format.timestamp(), jsonFormat),
      })
    );
  }

  return winston.createLogger({
    level: process.env.LOG_LEVEL || (IS_DEVELOPMENT ? 'debug' : 'info'),
    transports,
    exitOnError: false,
  });
};

const winstonLogger = createWinstonLogger();

/**
 * Standard logger with correlation ID support
 */
class Logger {
  _log(level: string, message: string, metadata: Record<string, any> = {}) {
    // Ensure metadata is an object
    const meta = metadata || {};

    // Remove null/undefined values
    const cleanMeta = Object.entries(meta).reduce((acc, [key, value]) => {
      if (value !== null && value !== undefined) {
        // Handle error objects
        if (key === 'error' && value instanceof Error) {
          acc[key] = {
            name: value.name,
            message: value.message,
            stack: value.stack,
          };
        } else {
          acc[key] = value;
        }
      }
      return acc;
    }, {} as Record<string, any>);

    winstonLogger.log(level, message, cleanMeta);
  }

  debug(message: string, metadata: Record<string, any> = {}) {
    this._log('debug', message, metadata);
  }

  info(message: string, metadata: Record<string, any> = {}) {
    this._log('info', message, metadata);
  }

  warn(message: string, metadata: Record<string, any> = {}) {
    this._log('warn', message, metadata);
  }

  error(message: string, metadata: Record<string, any> = {}) {
    this._log('error', message, metadata);
  }

  /**
   * Create a logger bound to a trace context (traceId and spanId)
   */
  withTraceContext(traceId: string, spanId?: string) {
    const traceMetadata = { traceId, ...(spanId && { spanId }) };
    return {
      debug: (message: string, metadata: Record<string, any> = {}) =>
        this.debug(message, { ...metadata, ...traceMetadata }),
      info: (message: string, metadata: Record<string, any> = {}) =>
        this.info(message, { ...metadata, ...traceMetadata }),
      warn: (message: string, metadata: Record<string, any> = {}) =>
        this.warn(message, { ...metadata, ...traceMetadata }),
      error: (message: string, metadata: Record<string, any> = {}) =>
        this.error(message, { ...metadata, ...traceMetadata }),
    };
  }
}

export const logger = new Logger();
export default logger;
