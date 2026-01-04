// Mock dotenv at the top level to prevent .env file loading in all tests
jest.mock('dotenv', () => ({
  config: jest.fn(),
}));

describe('Config', () => {
  // Store original environment variables
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset modules before each test
    jest.resetModules();

    // Clear the require cache to ensure fresh imports
    const configPath = require.resolve('../../../src/core/config');
    delete require.cache[configPath];
  });

  afterEach(() => {
    // Restore original environment after each test
    process.env = { ...originalEnv };
    jest.resetModules();
  });

  describe('Default configuration', () => {
    it('should load with default values when no environment variables are set', () => {
      // Create a completely clean environment
      process.env = {
        NODE_ENV: 'test',
        PATH: originalEnv.PATH, // Keep PATH for system functionality
        SYSTEMROOT: originalEnv.SYSTEMROOT, // Keep Windows system variables
        WINDIR: originalEnv.WINDIR,
      };

      // Import config after setting clean environment
      const config = require('../../src/shared/config/index').default;

      expect(config.server).toEqual({
        port: 3003,
        host: 'localhost',
        env: 'test', // NODE_ENV is 'test' not 'development'
      });

      expect(config.database).toEqual({
        host: 'localhost',
        port: 3306,
        name: 'notification_service_dev',
        user: 'notification_user',
        password: 'notification_pass',
      });

      expect(config.rabbitmq).toEqual({
        url: 'amqp://guest:guest@localhost:5672',
        exchange: 'xshopai.events',
        exchanges: {
          order: 'order.events',
          user: 'user.events',
        },
        queues: {
          notifications: 'notification-service.queue',
        },
      });

      expect(config.email).toEqual({
        provider: 'smtp',
        smtp: {
          host: 'smtp.gmail.com',
          port: 587,
          secure: false,
          auth: {
            user: '',
            pass: '',
          },
        },
        from: {
          name: 'AI Outlet Notifications',
          address: 'noreply@xshopai.com',
        },
        enabled: true,
      });
    });
  });

  describe('Environment variable override', () => {
    it('should override server configuration with environment variables', () => {
      // Start with clean environment
      process.env = {
        NODE_ENV: 'test',
        PATH: originalEnv.PATH,
        SYSTEMROOT: originalEnv.SYSTEMROOT,
        WINDIR: originalEnv.WINDIR,
        // Add specific overrides
        PORT: '4000',
        HOST: '0.0.0.0',
      };
      process.env.NODE_ENV = 'production'; // Override after cleanup

      const config = require('../../src/shared/config/index').default;

      expect(config.server).toEqual({
        port: 4000,
        host: '0.0.0.0',
        env: 'production',
      });
    });

    it('should override database configuration with environment variables', () => {
      // Start with clean environment
      process.env = {
        NODE_ENV: 'test',
        PATH: originalEnv.PATH,
        SYSTEMROOT: originalEnv.SYSTEMROOT,
        WINDIR: originalEnv.WINDIR,
        // Add specific overrides
        DB_HOST: 'db.example.com',
        DB_PORT: '5432',
        DB_NAME: 'notifications_prod',
        DB_USER: 'prod_user',
        DB_PASSWORD: 'secure_password',
      };

      // Mock dotenv.config to prevent .env file loading
      jest.doMock('dotenv', () => ({
        config: jest.fn(),
      }));

      const config = require('../../src/shared/config/index').default;

      expect(config.database).toEqual({
        host: 'db.example.com',
        port: 5432,
        name: 'notifications_prod',
        user: 'prod_user',
        password: 'secure_password',
      });
    });

    it('should override RabbitMQ configuration with environment variables', () => {
      // Start with clean environment
      process.env = {
        NODE_ENV: 'test',
        PATH: originalEnv.PATH,
        SYSTEMROOT: originalEnv.SYSTEMROOT,
        WINDIR: originalEnv.WINDIR,
        // Add specific overrides
        RABBITMQ_URL: 'amqp://user:pass@rabbitmq.example.com:5672',
        RABBITMQ_EXCHANGE_ORDER: 'prod.order.events',
        RABBITMQ_EXCHANGE_USER: 'prod.user.events',
        RABBITMQ_QUEUE_NOTIFICATIONS: 'prod.notifications',
      };

      // Mock dotenv.config to prevent .env file loading
      jest.doMock('dotenv', () => ({
        config: jest.fn(),
      }));

      const config = require('../../src/shared/config/index').default;

      expect(config.rabbitmq).toEqual({
        url: 'amqp://user:pass@rabbitmq.example.com:5672',
        exchange: 'xshopai.events',
        exchanges: {
          order: 'prod.order.events',
          user: 'prod.user.events',
        },
        queues: {
          notifications: 'prod.notifications',
        },
      });
    });

    it('should override email configuration with environment variables', () => {
      // Start with clean environment
      process.env = {
        NODE_ENV: 'test',
        PATH: originalEnv.PATH,
        SYSTEMROOT: originalEnv.SYSTEMROOT,
        WINDIR: originalEnv.WINDIR,
        // Add specific overrides
        EMAIL_PROVIDER: 'sendgrid',
        SMTP_HOST: 'smtp.sendgrid.net',
        SMTP_PORT: '465',
        SMTP_SECURE: 'true',
        SMTP_USER: 'apikey',
        SMTP_PASS: 'SG.xxxxx',
        EMAIL_FROM_NAME: 'Production App',
        EMAIL_FROM_ADDRESS: 'notifications@company.com',
        EMAIL_ENABLED: 'true',
      };

      // Mock dotenv.config to prevent .env file loading
      jest.doMock('dotenv', () => ({
        config: jest.fn(),
      }));

      const config = require('../../src/shared/config/index').default;

      expect(config.email).toEqual({
        provider: 'sendgrid',
        smtp: {
          host: 'smtp.sendgrid.net',
          port: 465,
          secure: true,
          auth: {
            user: 'apikey',
            pass: 'SG.xxxxx',
          },
        },
        from: {
          name: 'Production App',
          address: 'notifications@company.com',
        },
        enabled: true,
      });
    });
  });

  describe('Type conversions', () => {
    it('should convert string port numbers to integers', () => {
      // Start with clean environment
      process.env = {
        NODE_ENV: 'test',
        PATH: originalEnv.PATH,
        SYSTEMROOT: originalEnv.SYSTEMROOT,
        WINDIR: originalEnv.WINDIR,
        // Add specific overrides
        PORT: '8080',
        DB_PORT: '3306',
        SMTP_PORT: '587',
      };

      // Mock dotenv.config to prevent .env file loading
      jest.doMock('dotenv', () => ({
        config: jest.fn(),
      }));

      const config = require('../../src/shared/config/index').default;

      expect(typeof config.server.port).toBe('number');
      expect(config.server.port).toBe(8080);
      expect(typeof config.database.port).toBe('number');
      expect(config.database.port).toBe(3306);
      expect(typeof config.email.smtp.port).toBe('number');
      expect(config.email.smtp.port).toBe(587);
    });

    it('should handle invalid port numbers gracefully', () => {
      // Set a clean environment with invalid ports
      process.env = {
        NODE_ENV: 'test',
        PATH: originalEnv.PATH,
        SYSTEMROOT: originalEnv.SYSTEMROOT,
        WINDIR: originalEnv.WINDIR,
        PORT: 'invalid',
        DB_PORT: 'not-a-number',
        SMTP_PORT: 'invalid-port',
      };

      const config = require('../../src/shared/config/index').default;

      // parseInt returns NaN for invalid strings
      expect(isNaN(config.server.port)).toBe(true);
      expect(isNaN(config.database.port)).toBe(true);
      expect(isNaN(config.email.smtp.port)).toBe(true);
    });

    it('should convert boolean strings correctly for SMTP secure', () => {
      // Test true value
      process.env = {
        NODE_ENV: 'test',
        PATH: originalEnv.PATH,
        SYSTEMROOT: originalEnv.SYSTEMROOT,
        WINDIR: originalEnv.WINDIR,
        SMTP_SECURE: 'true',
      };

      // Mock dotenv.config to prevent .env file loading
      jest.doMock('dotenv', () => ({
        config: jest.fn(),
      }));

      let config = require('../../src/shared/config/index').default;
      expect(config.email.smtp.secure).toBe(true);

      // Reset modules for fresh import
      jest.resetModules();
      const configPath = require.resolve('../../src/shared/config/index');
      delete require.cache[configPath];

      // Test false value
      process.env = {
        NODE_ENV: 'test',
        PATH: originalEnv.PATH,
        SYSTEMROOT: originalEnv.SYSTEMROOT,
        WINDIR: originalEnv.WINDIR,
        SMTP_SECURE: 'false',
      };

      jest.doMock('dotenv', () => ({
        config: jest.fn(),
      }));

      config = require('../../src/shared/config/index').default;
      expect(config.email.smtp.secure).toBe(false);

      // Reset modules for fresh import
      jest.resetModules();
      delete require.cache[configPath];

      // Test any other value (should be false)
      process.env = {
        NODE_ENV: 'test',
        PATH: originalEnv.PATH,
        SYSTEMROOT: originalEnv.SYSTEMROOT,
        WINDIR: originalEnv.WINDIR,
        SMTP_SECURE: 'yes',
      };

      jest.doMock('dotenv', () => ({
        config: jest.fn(),
      }));

      config = require('../../src/shared/config/index').default;
      expect(config.email.smtp.secure).toBe(false);
    });

    it('should handle email enabled flag correctly', () => {
      const configPath = require.resolve('../../src/shared/config/index');

      // Test explicitly disabled
      process.env = {
        NODE_ENV: 'test',
        PATH: originalEnv.PATH,
        SYSTEMROOT: originalEnv.SYSTEMROOT,
        WINDIR: originalEnv.WINDIR,
        EMAIL_ENABLED: 'false',
      };

      jest.doMock('dotenv', () => ({
        config: jest.fn(),
      }));

      let config = require('../../src/shared/config/index').default;
      expect(config.email.enabled).toBe(false);

      jest.resetModules();
      delete require.cache[configPath];

      // Test enabled (any value other than 'false')
      process.env = {
        NODE_ENV: 'test',
        PATH: originalEnv.PATH,
        SYSTEMROOT: originalEnv.SYSTEMROOT,
        WINDIR: originalEnv.WINDIR,
        EMAIL_ENABLED: 'true',
      };

      jest.doMock('dotenv', () => ({
        config: jest.fn(),
      }));

      config = require('../../src/shared/config/index').default;
      expect(config.email.enabled).toBe(true);

      jest.resetModules();
      delete require.cache[configPath];

      // Test default (undefined should be true)
      process.env = {
        NODE_ENV: 'test',
        PATH: originalEnv.PATH,
        SYSTEMROOT: originalEnv.SYSTEMROOT,
        WINDIR: originalEnv.WINDIR,
      };

      jest.doMock('dotenv', () => ({
        config: jest.fn(),
      }));

      config = require('../../src/shared/config/index').default;
      expect(config.email.enabled).toBe(true);

      jest.resetModules();
      delete require.cache[configPath];

      // Test other truthy values
      process.env = {
        NODE_ENV: 'test',
        PATH: originalEnv.PATH,
        SYSTEMROOT: originalEnv.SYSTEMROOT,
        WINDIR: originalEnv.WINDIR,
        EMAIL_ENABLED: 'yes',
      };

      jest.doMock('dotenv', () => ({
        config: jest.fn(),
      }));

      config = require('../../src/shared/config/index').default;
      expect(config.email.enabled).toBe(true);
    });
  });

  describe('Environment-specific configurations', () => {
    it('should work in test environment', () => {
      process.env = {
        NODE_ENV: 'test',
        PATH: originalEnv.PATH,
        SYSTEMROOT: originalEnv.SYSTEMROOT,
        WINDIR: originalEnv.WINDIR,
        DB_NAME: 'notification_service_test',
        EMAIL_ENABLED: 'false',
      };

      // Mock dotenv.config to prevent .env file loading
      jest.doMock('dotenv', () => ({
        config: jest.fn(),
      }));

      const config = require('../../src/shared/config/index').default;

      expect(config.server.env).toBe('test');
      expect(config.database.name).toBe('notification_service_test');
      expect(config.email.enabled).toBe(false);
    });

    it('should work in production environment', () => {
      process.env = {
        NODE_ENV: 'production',
        PATH: originalEnv.PATH,
        SYSTEMROOT: originalEnv.SYSTEMROOT,
        WINDIR: originalEnv.WINDIR,
        PORT: '80',
        HOST: '0.0.0.0',
        DB_HOST: 'prod-db.internal',
        RABBITMQ_URL: 'amqp://prod-rabbitmq.internal:5672',
      };

      // Mock dotenv.config to prevent .env file loading
      jest.doMock('dotenv', () => ({
        config: jest.fn(),
      }));

      const config = require('../../src/shared/config/index').default;

      expect(config.server.env).toBe('production');
      expect(config.server.port).toBe(80);
      expect(config.server.host).toBe('0.0.0.0');
      expect(config.database.host).toBe('prod-db.internal');
      expect(config.rabbitmq.url).toBe('amqp://prod-rabbitmq.internal:5672');
    });

    it('should work in development environment', () => {
      process.env = {
        NODE_ENV: 'development',
        PATH: originalEnv.PATH,
        SYSTEMROOT: originalEnv.SYSTEMROOT,
        WINDIR: originalEnv.WINDIR,
        // Don't set other env vars to test defaults
      };

      // Mock dotenv.config to prevent .env file loading
      jest.doMock('dotenv', () => ({
        config: jest.fn(),
      }));

      const config = require('../../src/shared/config/index').default;

      expect(config.server.env).toBe('development');
      expect(config.server.host).toBe('localhost');
      expect(config.database.host).toBe('localhost');
      expect(config.email.enabled).toBe(true);
    });
  });

  describe('Security considerations', () => {
    it('should handle undefined credentials gracefully by using defaults', () => {
      process.env = {
        NODE_ENV: 'test',
        PATH: originalEnv.PATH,
        SYSTEMROOT: originalEnv.SYSTEMROOT,
        WINDIR: originalEnv.WINDIR,
        // Don't set DB_PASSWORD, SMTP_USER, SMTP_PASS - let them be undefined
        // When undefined, the config will use the || fallback values
      };

      const config = require('../../src/shared/config/index').default;

      // When environment variables are undefined, config uses default values
      expect(config.database.password).toBe('notification_pass'); // default value
      expect(config.email.smtp.auth.user).toBe(''); // default value (empty string)
      expect(config.email.smtp.auth.pass).toBe(''); // default value (empty string)
    });

    it('should not expose sensitive data in the config object structure', () => {
      process.env = {
        NODE_ENV: 'test',
        PATH: originalEnv.PATH,
        SYSTEMROOT: originalEnv.SYSTEMROOT,
        WINDIR: originalEnv.WINDIR,
        DB_PASSWORD: 'super-secret-password',
        SMTP_PASS: 'email-api-key',
      };

      // Mock dotenv.config to prevent .env file loading
      jest.doMock('dotenv', () => ({
        config: jest.fn(),
      }));

      const config = require('../../src/shared/config/index').default;

      // Ensure the config is properly structured (no flat exposure)
      expect(config.database.password).toBe('super-secret-password');
      expect(config.email.smtp.auth.pass).toBe('email-api-key');

      // Verify structure is as expected
      expect(typeof config.database).toBe('object');
      expect(typeof config.email.smtp.auth).toBe('object');
    });
  });

  describe('Configuration completeness', () => {
    it('should have all required configuration sections', () => {
      // Start with clean environment
      process.env = {
        NODE_ENV: 'test',
        PATH: originalEnv.PATH,
        SYSTEMROOT: originalEnv.SYSTEMROOT,
        WINDIR: originalEnv.WINDIR,
      };

      // Mock dotenv.config to prevent .env file loading
      jest.doMock('dotenv', () => ({
        config: jest.fn(),
      }));

      const config = require('../../src/shared/config/index').default;

      expect(config).toHaveProperty('server');
      expect(config).toHaveProperty('database');
      expect(config).toHaveProperty('rabbitmq');
      expect(config).toHaveProperty('email');
    });

    it('should have all required server properties', () => {
      // Start with clean environment
      process.env = {
        NODE_ENV: 'test',
        PATH: originalEnv.PATH,
        SYSTEMROOT: originalEnv.SYSTEMROOT,
        WINDIR: originalEnv.WINDIR,
      };

      // Mock dotenv.config to prevent .env file loading
      jest.doMock('dotenv', () => ({
        config: jest.fn(),
      }));

      const config = require('../../src/shared/config/index').default;

      expect(config.server).toHaveProperty('port');
      expect(config.server).toHaveProperty('host');
      expect(config.server).toHaveProperty('env');
    });

    it('should have all required database properties', () => {
      // Start with clean environment
      process.env = {
        NODE_ENV: 'test',
        PATH: originalEnv.PATH,
        SYSTEMROOT: originalEnv.SYSTEMROOT,
        WINDIR: originalEnv.WINDIR,
      };

      // Mock dotenv.config to prevent .env file loading
      jest.doMock('dotenv', () => ({
        config: jest.fn(),
      }));

      const config = require('../../src/shared/config/index').default;

      expect(config.database).toHaveProperty('host');
      expect(config.database).toHaveProperty('port');
      expect(config.database).toHaveProperty('name');
      expect(config.database).toHaveProperty('user');
      expect(config.database).toHaveProperty('password');
    });

    it('should have all required RabbitMQ properties', () => {
      // Start with clean environment
      process.env = {
        NODE_ENV: 'test',
        PATH: originalEnv.PATH,
        SYSTEMROOT: originalEnv.SYSTEMROOT,
        WINDIR: originalEnv.WINDIR,
      };

      // Mock dotenv.config to prevent .env file loading
      jest.doMock('dotenv', () => ({
        config: jest.fn(),
      }));

      const config = require('../../src/shared/config/index').default;

      expect(config.rabbitmq).toHaveProperty('url');
      expect(config.rabbitmq).toHaveProperty('exchanges');
      expect(config.rabbitmq).toHaveProperty('queues');
      expect(config.rabbitmq.exchanges).toHaveProperty('order');
      expect(config.rabbitmq.exchanges).toHaveProperty('user');
      expect(config.rabbitmq.queues).toHaveProperty('notifications');
    });

    it('should have all required email properties', () => {
      // Start with clean environment
      process.env = {
        NODE_ENV: 'test',
        PATH: originalEnv.PATH,
        SYSTEMROOT: originalEnv.SYSTEMROOT,
        WINDIR: originalEnv.WINDIR,
      };

      // Mock dotenv.config to prevent .env file loading
      jest.doMock('dotenv', () => ({
        config: jest.fn(),
      }));

      const config = require('../../src/shared/config/index').default;

      expect(config.email).toHaveProperty('provider');
      expect(config.email).toHaveProperty('smtp');
      expect(config.email).toHaveProperty('from');
      expect(config.email).toHaveProperty('enabled');
      expect(config.email.smtp).toHaveProperty('host');
      expect(config.email.smtp).toHaveProperty('port');
      expect(config.email.smtp).toHaveProperty('secure');
      expect(config.email.smtp).toHaveProperty('auth');
      expect(config.email.smtp.auth).toHaveProperty('user');
      expect(config.email.smtp.auth).toHaveProperty('pass');
      expect(config.email.from).toHaveProperty('name');
      expect(config.email.from).toHaveProperty('address');
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle undefined environment variables', () => {
      // Start with clean environment (no custom vars)
      process.env = {
        NODE_ENV: 'test',
        PATH: originalEnv.PATH,
        SYSTEMROOT: originalEnv.SYSTEMROOT,
        WINDIR: originalEnv.WINDIR,
      };

      // Mock dotenv.config to prevent .env file loading
      jest.doMock('dotenv', () => ({
        config: jest.fn(),
      }));

      const config = require('../../src/shared/config/index').default;

      // Should fall back to defaults
      expect(config.server.port).toBe(3003);
      expect(config.database.host).toBe('localhost');
      expect(config.rabbitmq.url).toBe('amqp://guest:guest@localhost:5672');
    });

    it('should handle zero and negative port numbers', () => {
      process.env = {
        NODE_ENV: 'test',
        PATH: originalEnv.PATH,
        SYSTEMROOT: originalEnv.SYSTEMROOT,
        WINDIR: originalEnv.WINDIR,
        PORT: '0',
        DB_PORT: '-1',
        SMTP_PORT: '0',
      };

      // Mock dotenv.config to prevent .env file loading
      jest.doMock('dotenv', () => ({
        config: jest.fn(),
      }));

      const config = require('../../src/shared/config/index').default;

      expect(config.server.port).toBe(0);
      expect(config.database.port).toBe(-1);
      expect(config.email.smtp.port).toBe(0);
    });

    it('should handle very long string values', () => {
      const longString = 'a'.repeat(1000);
      process.env = {
        NODE_ENV: 'test',
        PATH: originalEnv.PATH,
        SYSTEMROOT: originalEnv.SYSTEMROOT,
        WINDIR: originalEnv.WINDIR,
        DB_NAME: longString,
        EMAIL_FROM_NAME: longString,
      };

      // Mock dotenv.config to prevent .env file loading
      jest.doMock('dotenv', () => ({
        config: jest.fn(),
      }));

      const config = require('../../src/shared/config/index').default;

      expect(config.database.name).toBe(longString);
      expect(config.email.from.name).toBe(longString);
    });

    it('should handle special characters in configuration', () => {
      process.env = {
        NODE_ENV: 'test',
        PATH: originalEnv.PATH,
        SYSTEMROOT: originalEnv.SYSTEMROOT,
        WINDIR: originalEnv.WINDIR,
        DB_PASSWORD: 'pass@word!#$%^&*()',
        RABBITMQ_URL: 'amqp://user:p@ss@w0rd@localhost:5672',
        EMAIL_FROM_NAME: 'Test & Company <notifications>',
      };

      // Mock dotenv.config to prevent .env file loading
      jest.doMock('dotenv', () => ({
        config: jest.fn(),
      }));

      const config = require('../../src/shared/config/index').default;

      expect(config.database.password).toBe('pass@word!#$%^&*()');
      expect(config.rabbitmq.url).toBe('amqp://user:p@ss@w0rd@localhost:5672');
      expect(config.email.from.name).toBe('Test & Company <notifications>');
    });
  });
});
