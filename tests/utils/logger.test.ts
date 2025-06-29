import logger from '../../src/utils/logger';

// Extend global types for Jest
declare const jest: any;

describe('Logger', () => {
  // Mock console methods
  let consoleSpy: {
    log: any;
    error: any;
    warn: any;
    debug: any;
  };

  beforeEach(() => {
    // Create spies for console methods before each test
    consoleSpy = {
      log: jest.spyOn(console, 'log').mockImplementation(() => {}),
      error: jest.spyOn(console, 'error').mockImplementation(() => {}),
      warn: jest.spyOn(console, 'warn').mockImplementation(() => {}),
      debug: jest.spyOn(console, 'debug').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    // Restore console methods after each test
    jest.restoreAllMocks();
  });

  describe('info method', () => {
    it('should log info message with timestamp', () => {
      const message = 'Test info message';

      logger.info(message);

      expect(consoleSpy.log).toHaveBeenCalledTimes(1);
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] INFO: Test info message$/)
      );
    });

    it('should log info message with additional arguments', () => {
      const message = 'Test info with args';
      const arg1 = { key: 'value' };
      const arg2 = 123;

      logger.info(message, arg1, arg2);

      expect(consoleSpy.log).toHaveBeenCalledTimes(1);
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] INFO: Test info with args$/),
        arg1,
        arg2
      );
    });
  });

  describe('error method', () => {
    it('should log error message with timestamp', () => {
      const message = 'Test error message';

      logger.error(message);

      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] ERROR: Test error message$/)
      );
    });

    it('should log error message with Error object', () => {
      const message = 'Database connection failed';
      const error = new Error('Connection timeout');

      logger.error(message, error);

      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] ERROR: Database connection failed$/),
        error
      );
    });

    it('should log error message with additional context', () => {
      const message = 'API request failed';
      const context = { url: '/api/test', status: 500, requestId: '123' };

      logger.error(message, context);

      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] ERROR: API request failed$/),
        context
      );
    });
  });

  describe('warn method', () => {
    it('should log warning message with timestamp', () => {
      const message = 'Test warning message';

      logger.warn(message);

      expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] WARN: Test warning message$/)
      );
    });

    it('should log warning message with multiple arguments', () => {
      const message = 'Configuration warning';
      const config = { deprecated: 'old_setting' };
      const suggestion = 'Use new_setting instead';

      logger.warn(message, config, suggestion);

      expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] WARN: Configuration warning$/),
        config,
        suggestion
      );
    });
  });

  describe('debug method', () => {
    it('should log debug message with timestamp', () => {
      const message = 'Test debug message';

      logger.debug(message);

      expect(consoleSpy.debug).toHaveBeenCalledTimes(1);
      expect(consoleSpy.debug).toHaveBeenCalledWith(
        expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] DEBUG: Test debug message$/)
      );
    });

    it('should log debug message with complex data structures', () => {
      const message = 'Processing data';
      const data = {
        request: { id: '123', timestamp: Date.now() },
        response: { status: 'pending', items: [1, 2, 3] },
      };

      logger.debug(message, data);

      expect(consoleSpy.debug).toHaveBeenCalledTimes(1);
      expect(consoleSpy.debug).toHaveBeenCalledWith(
        expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] DEBUG: Processing data$/),
        data
      );
    });
  });

  describe('timestamp format', () => {
    it('should generate valid ISO timestamp', () => {
      logger.info('Test message');

      const logCall = consoleSpy.log.mock.calls[0][0];
      const timestampMatch = logCall.match(/\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)\]/);

      expect(timestampMatch).not.toBeNull();

      if (timestampMatch) {
        const timestamp = timestampMatch[1];
        const date = new Date(timestamp);

        expect(date).toBeInstanceOf(Date);
        expect(date.getTime()).not.toBeNaN();
        expect(timestamp).toBe(date.toISOString());
      }
    });

    it('should generate recent timestamp', () => {
      const beforeCall = Date.now();
      logger.info('Test message');
      const afterCall = Date.now();

      const logCall = consoleSpy.log.mock.calls[0][0];
      const timestampMatch = logCall.match(/\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)\]/);

      expect(timestampMatch).not.toBeNull();

      if (timestampMatch) {
        const timestamp = timestampMatch[1];
        const logTime = new Date(timestamp).getTime();

        // Timestamp should be between before and after the call (within reasonable margin)
        expect(logTime).toBeGreaterThanOrEqual(beforeCall - 1000); // 1 second margin
        expect(logTime).toBeLessThanOrEqual(afterCall + 1000); // 1 second margin
      }
    });
  });

  describe('logger instance', () => {
    it('should be a singleton instance', () => {
      // Import logger again to test singleton behavior
      const logger2 = require('../../src/utils/logger').default;

      expect(logger).toBe(logger2);
    });

    it('should have all required methods', () => {
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.debug).toBe('function');
    });
  });

  describe('edge cases', () => {
    it('should handle empty message', () => {
      logger.info('');

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] INFO: $/)
      );
    });

    it('should handle undefined arguments', () => {
      logger.info('Test message', undefined, null);

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] INFO: Test message$/),
        undefined,
        null
      );
    });

    it('should handle circular references in objects', () => {
      const obj: any = { name: 'test' };
      obj.self = obj; // Create circular reference

      // This should not throw an error
      expect(() => {
        logger.info('Test with circular reference', obj);
      }).not.toThrow();

      expect(consoleSpy.log).toHaveBeenCalledTimes(1);
    });

    it('should handle very long messages', () => {
      const longMessage = 'a'.repeat(10000);

      logger.info(longMessage);

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringMatching(
          new RegExp(`^\\[\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z\\] INFO: ${longMessage}$`)
        )
      );
    });
  });
});
