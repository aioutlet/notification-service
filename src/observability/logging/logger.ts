import winston from 'winston';
import { LOG_LEVELS, DEFAULT_CONFIG, ENVIRONMENT_CONFIGS, LoggerConfig } from './schemas.js';
import { createJsonFormat, createConsoleFormat } from './formatters.js';

/**
 * Logger class implementing the unified logging schema
 */
class Logger {
  private winston: winston.Logger;
  private config: LoggerConfig;

  constructor(config: Partial<LoggerConfig> = {}) {
    // Get environment-specific config
    const environment = process.env.NODE_ENV || 'development';
    const envConfig = ENVIRONMENT_CONFIGS[environment] || ENVIRONMENT_CONFIGS.development;

    // Get service name early for path calculation
    const serviceName = process.env.SERVICE_NAME || config.serviceName || envConfig.serviceName;

    // Merge configurations: env vars > passed config > env defaults > global defaults
    this.config = {
      ...DEFAULT_CONFIG,
      ...envConfig,
      ...config,
      // Override with environment variables
      serviceName: serviceName,
      version: this._getServiceVersion(),
      environment: environment,
      logLevel: (process.env.LOG_LEVEL || config.logLevel || envConfig.logLevel) as keyof typeof LOG_LEVELS,
      format: (process.env.LOG_FORMAT || config.format || envConfig.format) as 'json' | 'console',
      enableConsole: this._parseBoolean(process.env.LOG_TO_CONSOLE, config.enableConsole ?? envConfig.enableConsole),
      enableFile: this._parseBoolean(process.env.LOG_TO_FILE, config.enableFile ?? envConfig.enableFile),
      enableTracing: this._parseBoolean(process.env.ENABLE_TRACING, config.enableTracing ?? envConfig.enableTracing),
      filePath: process.env.LOG_FILE_PATH || config.filePath || this._getDefaultLogPath(environment, serviceName),
    };

    // Initialize Winston logger
    this._initializeWinston();

    // Log initialization
    this.info('Logger initialized', null, {
      operation: 'logger_initialization',
      metadata: {
        config: {
          ...this.config,
          // Don't log sensitive paths in production
          filePath: this.config.environment === 'production' ? '[REDACTED]' : this.config.filePath,
        },
      },
    });
  }

  /**
   * Get service version from environment or package.json
   */
  private _getServiceVersion(): string {
    try {
      return process.env.SERVICE_VERSION || '1.0.0';
    } catch {
      return '1.0.0';
    }
  }

  /**
   * Parse boolean from environment variable or return default
   */
  private _parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
    if (value === undefined || value === null) {
      return defaultValue;
    }
    return value === 'true' || value === true;
  }

  /**
   * Get default log file path based on environment
   */
  private _getDefaultLogPath(environment: string, serviceName: string): string {
    const isDevelopment = environment === 'development';
    return isDevelopment ? `./logs/${serviceName}.log` : `/app/logs/${serviceName}.log`;
  }

  /**
   * Initialize Winston logger with unified schema formatting
   */
  private _initializeWinston(): void {
    const transports: winston.transport[] = [];

    // Console transport
    if (this.config.enableConsole && this.config.environment !== 'test') {
      transports.push(
        new winston.transports.Console({
          format: this.config.format === 'json' ? createJsonFormat(this.config) : createConsoleFormat(this.config),
          level: this.config.logLevel.toLowerCase(),
        })
      );
    }

    // File transport
    if (this.config.enableFile && this.config.filePath) {
      transports.push(
        new winston.transports.File({
          filename: this.config.filePath,
          format: createJsonFormat(this.config),
          level: this.config.logLevel.toLowerCase(),
        })
      );
    }

    // Exception and rejection handlers
    const exceptionHandlers: winston.transport[] = [];
    const rejectionHandlers: winston.transport[] = [];

    if (this.config.enableFile && this.config.filePath) {
      exceptionHandlers.push(
        new winston.transports.File({
          filename: this.config.filePath.replace('.log', '-exceptions.log'),
        })
      );
      rejectionHandlers.push(
        new winston.transports.File({
          filename: this.config.filePath.replace('.log', '-rejections.log'),
        })
      );
    }

    if (this.config.enableConsole && this.config.environment !== 'test') {
      exceptionHandlers.push(
        new winston.transports.Console({
          format: createConsoleFormat(this.config),
        })
      );
      rejectionHandlers.push(
        new winston.transports.Console({
          format: createConsoleFormat(this.config),
        })
      );
    }

    // Create Winston logger
    this.winston = winston.createLogger({
      level: this.config.logLevel.toLowerCase(),
      transports,
      exitOnError: false,
      exceptionHandlers,
      rejectionHandlers,
    });
  }

  /**
   * Core logging method
   */
  private _log(level: keyof typeof LOG_LEVELS, message: string, req: any = null, additionalData: any = {}): void {
    if (!this._shouldLog(level)) {
      return;
    }

    const logData = {
      level: level.toLowerCase(),
      message,
      correlationId: req?.correlationId || additionalData.correlationId || null,
      userId: req?.user?.id || additionalData.userId || null,
      operation: additionalData.operation || null,
      duration: additionalData.duration || null,
      businessEvent: additionalData.businessEvent || null,
      securityEvent: additionalData.securityEvent || null,
      error: this._processError(additionalData.error),
      metadata: additionalData.metadata || null,
    };

    // Remove null/undefined values
    Object.keys(logData).forEach((key) => {
      if (logData[key as keyof typeof logData] === null || logData[key as keyof typeof logData] === undefined) {
        delete logData[key as keyof typeof logData];
      }
    });

    this.winston.log(logData);
  }

  /**
   * Process error object to ensure it's serializable
   */
  private _processError(error: any): any {
    if (!error) {
      return null;
    }

    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    return error;
  }

  /**
   * Check if we should log at this level
   */
  private _shouldLog(level: keyof typeof LOG_LEVELS): boolean {
    const currentLevelValue = LOG_LEVELS[this.config.logLevel]?.value || 1;
    const logLevelValue = LOG_LEVELS[level]?.value || 1;
    return logLevelValue >= currentLevelValue;
  }

  // Public logging methods

  /**
   * Debug level logging
   */
  debug(message: string, req: any = null, additionalData: any = {}): void {
    this._log('DEBUG', message, req, additionalData);
  }

  /**
   * Info level logging
   */
  info(message: string, req: any = null, additionalData: any = {}): void {
    this._log('INFO', message, req, additionalData);
  }

  /**
   * Warning level logging
   */
  warn(message: string, req: any = null, additionalData: any = {}): void {
    this._log('WARN', message, req, additionalData);
  }

  /**
   * Error level logging
   */
  error(message: string, req: any = null, additionalData: any = {}): void {
    this._log('ERROR', message, req, additionalData);
  }

  /**
   * Fatal level logging
   */
  fatal(message: string, req: any = null, additionalData: any = {}): void {
    this._log('FATAL', message, req, additionalData);
  }

  // Convenience methods

  /**
   * Log operation start
   */
  operationStart(operation: string, req: any = null, additionalData: any = {}): number {
    this.debug(`Starting operation: ${operation}`, req, {
      operation,
      operationStart: true,
      ...additionalData,
    });
    return Date.now();
  }

  /**
   * Log operation completion
   */
  operationComplete(operation: string, startTime: number, req: any = null, additionalData: any = {}): number {
    const duration = Date.now() - startTime;
    this.info(`Completed operation: ${operation}`, req, {
      operation,
      duration,
      operationComplete: true,
      ...additionalData,
    });
    return duration;
  }

  /**
   * Log operation failure
   */
  operationFailed(operation: string, startTime: number, error: any, req: any = null, additionalData: any = {}): number {
    const duration = Date.now() - startTime;
    this.error(`Failed operation: ${operation}`, req, {
      operation,
      duration,
      error,
      operationFailed: true,
      ...additionalData,
    });
    return duration;
  }

  /**
   * Log business events
   */
  business(event: string, req: any = null, additionalData: any = {}): void {
    this.info(`Business event: ${event}`, req, {
      businessEvent: event,
      ...additionalData,
    });
  }

  /**
   * Log security events
   */
  security(event: string, req: any = null, additionalData: any = {}): void {
    this.warn(`Security event: ${event}`, req, {
      securityEvent: event,
      ...additionalData,
    });
  }

  /**
   * Log performance metrics
   */
  performance(operation: string, duration: number, req: any = null, additionalData: any = {}): void {
    const level = duration > 1000 ? 'WARN' : 'INFO';
    this._log(level as keyof typeof LOG_LEVELS, `Performance: ${operation}`, req, {
      operation,
      duration,
      performance: true,
      ...additionalData,
    });
  }

  /**
   * Get current configuration
   */
  getConfig(): LoggerConfig {
    return { ...this.config };
  }
}

export default Logger;
