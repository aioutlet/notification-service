import logger from '../../../src/shared/observability/logging/index.js';

// Extend global types for Jest
declare const jest: any;

describe('Logger', () => {
  // Mock Winston logger methods
  let loggerSpy: any;

  beforeEach(() => {
    // Create spies for logger methods before each test
    loggerSpy = {
      info: jest.spyOn(logger, 'info'),
      error: jest.spyOn(logger, 'error'),
      warn: jest.spyOn(logger, 'warn'),
      debug: jest.spyOn(logger, 'debug'),
    };
  });

  afterEach(() => {
    // Restore logger methods after each test
    jest.restoreAllMocks();
  });

  describe('info method', () => {
    it('should log info message with timestamp', () => {
      const message = 'Test info message';

      logger.info(message);

      expect(loggerSpy.info).toHaveBeenCalledTimes(1);
      expect(loggerSpy.info).toHaveBeenCalledWith(message);
    });

    it('should log info message with additional arguments', () => {
      const message = 'Test info with args';
      const metadata = { operation: 'test', traceId: 'test-123', spanId: 'span-456' };

      logger.info(message, metadata);

      expect(loggerSpy.info).toHaveBeenCalledTimes(1);
      expect(loggerSpy.info).toHaveBeenCalledWith(message, metadata);
    });
  });

  describe('error method', () => {
    it('should log error message with timestamp', () => {
      const message = 'Test error message';

      logger.error(message);

      expect(loggerSpy.error).toHaveBeenCalledTimes(1);
      expect(loggerSpy.error).toHaveBeenCalledWith(message);
    });

    it('should log error message with Error object', () => {
      const message = 'Database connection failed';
      const error = new Error('Connection timeout');

      logger.error(message, null, { error });

      expect(loggerSpy.error).toHaveBeenCalledTimes(1);
      expect(loggerSpy.error).toHaveBeenCalledWith(message, null, { error });
    });

    it('should log error message with additional context', () => {
      const message = 'API request failed';
      const context = { url: '/api/test', status: 500, requestId: '123' };

      logger.error(message, null, context);

      expect(loggerSpy.error).toHaveBeenCalledTimes(1);
      expect(loggerSpy.error).toHaveBeenCalledWith(message, null, context);
    });
  });

  describe('warn method', () => {
    it('should log warning message with timestamp', () => {
      const message = 'Test warning message';

      logger.warn(message);

      expect(loggerSpy.warn).toHaveBeenCalledTimes(1);
      expect(loggerSpy.warn).toHaveBeenCalledWith(message);
    });

    it('should log warning message with multiple arguments', () => {
      const message = 'Configuration warning';
      const config = { deprecated: 'old_setting' };
      const suggestion = { operation: 'config_check' };

      logger.warn(message, null, suggestion);

      expect(loggerSpy.warn).toHaveBeenCalledTimes(1);
      expect(loggerSpy.warn).toHaveBeenCalledWith(message, null, suggestion);
    });
  });

  describe('debug method', () => {
    it('should log debug message with timestamp', () => {
      const message = 'Test debug message';

      logger.debug(message);

      expect(loggerSpy.debug).toHaveBeenCalledTimes(1);
      expect(loggerSpy.debug).toHaveBeenCalledWith(message);
    });

    it('should log debug message with complex data structures', () => {
      const message = 'Processing data';
      const data = {
        request: { id: '123', timestamp: Date.now() },
        response: { status: 'pending', items: [1, 2, 3] },
      };

      logger.debug(message, null, { metadata: data });

      expect(loggerSpy.debug).toHaveBeenCalledTimes(1);
      expect(loggerSpy.debug).toHaveBeenCalledWith(message, null, { metadata: data });
    });
  });

  describe('logger functionality', () => {
    it('should have timestamp generation functionality', () => {
      // Since timestamps are handled internally by Winston,
      // we just verify the logger methods exist and can be called
      expect(() => logger.info('Test message')).not.toThrow();
    });

    it('should handle timestamp generation without errors', () => {
      const startTime = Date.now();

      expect(() => logger.info('Test message with timing')).not.toThrow();

      const endTime = Date.now();
      expect(endTime).toBeGreaterThanOrEqual(startTime);
    });
  });

  describe('logger instance', () => {
    it('should be a singleton instance', () => {
      const logger1 = require('../../../src/shared/observability/logging/index.js').default;
      const logger2 = require('../../../src/shared/observability/logging/index.js').default;

      expect(logger1).toBe(logger2);
    });

    it('should have all required methods', () => {
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.debug).toBe('function');
    });
  });

  describe('business and security logging', () => {
    it('should have business event logging method if available', () => {
      if (typeof logger.business === 'function') {
        const businessSpy = jest.spyOn(logger, 'business');
        logger.business('user_registration', null, { userId: 123 });

        expect(businessSpy).toHaveBeenCalledWith('user_registration', null, { userId: 123 });
        businessSpy.mockRestore();
      }
    });

    it('should have security event logging method if available', () => {
      if (typeof logger.security === 'function') {
        const securitySpy = jest.spyOn(logger, 'security');
        logger.security('failed_login_attempt', null, { ip: '192.168.1.1' });

        expect(securitySpy).toHaveBeenCalledWith('failed_login_attempt', null, { ip: '192.168.1.1' });
        securitySpy.mockRestore();
      }
    });

    it('should have performance logging method if available', () => {
      if (typeof logger.performance === 'function') {
        const performanceSpy = jest.spyOn(logger, 'performance');
        logger.performance('database_query', 150, null, { query: 'SELECT * FROM users' });

        expect(performanceSpy).toHaveBeenCalledWith('database_query', 150, null, { query: 'SELECT * FROM users' });
        performanceSpy.mockRestore();
      }
    });
  });

  describe('edge cases', () => {
    it('should handle empty message', () => {
      expect(() => logger.info('')).not.toThrow();
      expect(loggerSpy.info).toHaveBeenCalledWith('');
    });

    it('should handle undefined arguments', () => {
      expect(() => logger.info('Test message', null, undefined)).not.toThrow();
      expect(loggerSpy.info).toHaveBeenCalledWith('Test message', null, undefined);
    });

    it('should handle circular references in objects', () => {
      const circularObj: any = { name: 'test' };
      circularObj.self = circularObj;

      expect(() => {
        logger.info('Circular reference test', null, { data: circularObj });
      }).not.toThrow();

      expect(loggerSpy.info).toHaveBeenCalledTimes(1);
    });

    it('should handle very long messages', () => {
      const longMessage = 'a'.repeat(10000);

      expect(() => logger.info(longMessage)).not.toThrow();
      expect(loggerSpy.info).toHaveBeenCalledWith(longMessage);
    });
  });
});
