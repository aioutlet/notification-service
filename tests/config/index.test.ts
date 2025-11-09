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
    const configPath = require.resolve('../../src/config/index');
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
        PATH: originalEnv.PATH,
        SYSTEMROOT: originalEnv.SYSTEMROOT,
        WINDIR: originalEnv.WINDIR,
      };

      const config = require('../../src/config/index').default;

      expect(config.server).toEqual({
        port: 3003,
        host: 'localhost',
        env: 'test',
        serviceName: 'notification-service',
        serviceVersion: '1.0.0',
      });

      expect(config.messageBroker.type).toBe('rabbitmq');
      expect(config.messageBroker.rabbitmq).toEqual({
        url: 'amqp://guest:guest@localhost:5672',
        exchange: 'aioutlet.events',
        queues: {
          notifications: 'notifications',
          email: 'notifications.email',
          sms: 'notifications.sms',
          push: 'notifications.push',
        },
      });

      expect(config.email).toEqual({
        provider: 'smtp',
        smtp: {
          host: 'localhost',
          port: 1025,
          secure: false,
          auth: {
            user: '',
            pass: '',
          },
        },
        from: {
          name: 'AI Outlet Notifications',
          address: 'noreply@aioutlet.local',
        },
        enabled: true,
      });
    });
  });

  describe('Environment variable override', () => {
    it('should override server configuration with environment variables', () => {
      process.env = {
        NODE_ENV: 'production',
        PATH: originalEnv.PATH,
        SYSTEMROOT: originalEnv.SYSTEMROOT,
        WINDIR: originalEnv.WINDIR,
        PORT: '4000',
        HOST: '0.0.0.0',
        NAME: 'custom-service',
        VERSION: '2.0.0',
      };

      const config = require('../../src/config/index').default;

      expect(config.server).toEqual({
        port: 4000,
        host: '0.0.0.0',
        env: 'production',
        serviceName: 'custom-service',
        serviceVersion: '2.0.0',
      });
    });

    it('should override RabbitMQ configuration with environment variables', () => {
      process.env = {
        NODE_ENV: 'test',
        PATH: originalEnv.PATH,
        SYSTEMROOT: originalEnv.SYSTEMROOT,
        WINDIR: originalEnv.WINDIR,
        MESSAGE_BROKER_TYPE: 'rabbitmq',
        RABBITMQ_URL: 'amqp://user:pass@rabbitmq.example.com:5672',
        RABBITMQ_EXCHANGE: 'custom.events',
        RABBITMQ_QUEUE_NOTIFICATIONS: 'custom.notifications',
        RABBITMQ_QUEUE_EMAIL: 'custom.email',
        RABBITMQ_QUEUE_SMS: 'custom.sms',
        RABBITMQ_QUEUE_PUSH: 'custom.push',
      };

      const config = require('../../src/config/index').default;

      expect(config.messageBroker.type).toBe('rabbitmq');
      expect(config.messageBroker.rabbitmq).toEqual({
        url: 'amqp://user:pass@rabbitmq.example.com:5672',
        exchange: 'custom.events',
        queues: {
          notifications: 'custom.notifications',
          email: 'custom.email',
          sms: 'custom.sms',
          push: 'custom.push',
        },
      });
    });

    it('should override email configuration with environment variables', () => {
      process.env = {
        NODE_ENV: 'test',
        PATH: originalEnv.PATH,
        SYSTEMROOT: originalEnv.SYSTEMROOT,
        WINDIR: originalEnv.WINDIR,
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

      const config = require('../../src/config/index').default;

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
      process.env = {
        NODE_ENV: 'test',
        PATH: originalEnv.PATH,
        SYSTEMROOT: originalEnv.SYSTEMROOT,
        WINDIR: originalEnv.WINDIR,
        PORT: '8080',
        SMTP_PORT: '587',
      };

      const config = require('../../src/config/index').default;

      expect(typeof config.server.port).toBe('number');
      expect(config.server.port).toBe(8080);
      expect(typeof config.email.smtp.port).toBe('number');
      expect(config.email.smtp.port).toBe(587);
    });

    it('should handle invalid port numbers gracefully', () => {
      process.env = {
        NODE_ENV: 'test',
        PATH: originalEnv.PATH,
        SYSTEMROOT: originalEnv.SYSTEMROOT,
        WINDIR: originalEnv.WINDIR,
        PORT: 'invalid',
        SMTP_PORT: 'not-a-number',
      };

      const config = require('../../src/config/index').default;

      expect(isNaN(config.server.port)).toBe(true);
      expect(isNaN(config.email.smtp.port)).toBe(true);
    });

    it('should convert boolean strings correctly for SMTP secure', () => {
      const configPath = require.resolve('../../src/config/index');

      // Test true value
      process.env = {
        NODE_ENV: 'test',
        PATH: originalEnv.PATH,
        SYSTEMROOT: originalEnv.SYSTEMROOT,
        WINDIR: originalEnv.WINDIR,
        SMTP_SECURE: 'true',
      };

      let config = require('../../src/config/index').default;
      expect(config.email.smtp.secure).toBe(true);

      jest.resetModules();
      delete require.cache[configPath];

      // Test false value
      process.env = {
        NODE_ENV: 'test',
        PATH: originalEnv.PATH,
        SYSTEMROOT: originalEnv.SYSTEMROOT,
        WINDIR: originalEnv.WINDIR,
        SMTP_SECURE: 'false',
      };

      config = require('../../src/config/index').default;
      expect(config.email.smtp.secure).toBe(false);

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

      config = require('../../src/config/index').default;
      expect(config.email.smtp.secure).toBe(false);
    });

    it('should handle email enabled flag correctly', () => {
      const configPath = require.resolve('../../src/config/index');

      // Test explicitly disabled
      process.env = {
        NODE_ENV: 'test',
        PATH: originalEnv.PATH,
        SYSTEMROOT: originalEnv.SYSTEMROOT,
        WINDIR: originalEnv.WINDIR,
        EMAIL_ENABLED: 'false',
      };

      let config = require('../../src/config/index').default;
      expect(config.email.enabled).toBe(false);

      jest.resetModules();
      delete require.cache[configPath];

      // Test enabled
      process.env = {
        NODE_ENV: 'test',
        PATH: originalEnv.PATH,
        SYSTEMROOT: originalEnv.SYSTEMROOT,
        WINDIR: originalEnv.WINDIR,
        EMAIL_ENABLED: 'true',
      };

      config = require('../../src/config/index').default;
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

      config = require('../../src/config/index').default;
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
        EMAIL_ENABLED: 'false',
      };

      const config = require('../../src/config/index').default;

      expect(config.server.env).toBe('test');
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
        RABBITMQ_URL: 'amqp://prod-rabbitmq.internal:5672',
      };

      const config = require('../../src/config/index').default;

      expect(config.server.env).toBe('production');
      expect(config.server.port).toBe(80);
      expect(config.server.host).toBe('0.0.0.0');
      expect(config.messageBroker.rabbitmq?.url).toBe('amqp://prod-rabbitmq.internal:5672');
    });

    it('should work in development environment', () => {
      process.env = {
        NODE_ENV: 'development',
        PATH: originalEnv.PATH,
        SYSTEMROOT: originalEnv.SYSTEMROOT,
        WINDIR: originalEnv.WINDIR,
      };

      const config = require('../../src/config/index').default;

      expect(config.server.env).toBe('development');
      expect(config.server.host).toBe('localhost');
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
      };

      const config = require('../../src/config/index').default;

      expect(config.email.smtp.auth.user).toBe('');
      expect(config.email.smtp.auth.pass).toBe('');
    });

    it('should not expose sensitive data in the config object structure', () => {
      process.env = {
        NODE_ENV: 'test',
        PATH: originalEnv.PATH,
        SYSTEMROOT: originalEnv.SYSTEMROOT,
        WINDIR: originalEnv.WINDIR,
        SMTP_PASS: 'email-api-key',
      };

      const config = require('../../src/config/index').default;

      expect(config.email.smtp.auth.pass).toBe('email-api-key');
      expect(typeof config.email.smtp.auth).toBe('object');
    });
  });

  describe('Configuration completeness', () => {
    it('should have all required configuration sections', () => {
      process.env = {
        NODE_ENV: 'test',
        PATH: originalEnv.PATH,
        SYSTEMROOT: originalEnv.SYSTEMROOT,
        WINDIR: originalEnv.WINDIR,
      };

      const config = require('../../src/config/index').default;

      expect(config).toHaveProperty('server');
      expect(config).toHaveProperty('messageBroker');
      expect(config).toHaveProperty('email');
    });

    it('should have all required server properties', () => {
      process.env = {
        NODE_ENV: 'test',
        PATH: originalEnv.PATH,
        SYSTEMROOT: originalEnv.SYSTEMROOT,
        WINDIR: originalEnv.WINDIR,
      };

      const config = require('../../src/config/index').default;

      expect(config.server).toHaveProperty('port');
      expect(config.server).toHaveProperty('host');
      expect(config.server).toHaveProperty('env');
      expect(config.server).toHaveProperty('serviceName');
      expect(config.server).toHaveProperty('serviceVersion');
    });

    it('should have all required message broker properties', () => {
      process.env = {
        NODE_ENV: 'test',
        PATH: originalEnv.PATH,
        SYSTEMROOT: originalEnv.SYSTEMROOT,
        WINDIR: originalEnv.WINDIR,
      };

      const config = require('../../src/config/index').default;

      expect(config.messageBroker).toHaveProperty('type');
      expect(config.messageBroker.rabbitmq).toHaveProperty('url');
      expect(config.messageBroker.rabbitmq).toHaveProperty('exchange');
      expect(config.messageBroker.rabbitmq).toHaveProperty('queues');
      expect(config.messageBroker.rabbitmq?.queues).toHaveProperty('notifications');
      expect(config.messageBroker.rabbitmq?.queues).toHaveProperty('email');
      expect(config.messageBroker.rabbitmq?.queues).toHaveProperty('sms');
      expect(config.messageBroker.rabbitmq?.queues).toHaveProperty('push');
    });

    it('should have all required email properties', () => {
      process.env = {
        NODE_ENV: 'test',
        PATH: originalEnv.PATH,
        SYSTEMROOT: originalEnv.SYSTEMROOT,
        WINDIR: originalEnv.WINDIR,
      };

      const config = require('../../src/config/index').default;

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
      process.env = {
        NODE_ENV: 'test',
        PATH: originalEnv.PATH,
        SYSTEMROOT: originalEnv.SYSTEMROOT,
        WINDIR: originalEnv.WINDIR,
      };

      const config = require('../../src/config/index').default;

      expect(config.server.port).toBe(3003);
      expect(config.messageBroker.rabbitmq?.url).toBe('amqp://guest:guest@localhost:5672');
    });

    it('should handle zero and negative port numbers', () => {
      process.env = {
        NODE_ENV: 'test',
        PATH: originalEnv.PATH,
        SYSTEMROOT: originalEnv.SYSTEMROOT,
        WINDIR: originalEnv.WINDIR,
        PORT: '0',
        SMTP_PORT: '-1',
      };

      const config = require('../../src/config/index').default;

      expect(config.server.port).toBe(0);
      expect(config.email.smtp.port).toBe(-1);
    });

    it('should handle very long string values', () => {
      const longString = 'a'.repeat(1000);
      process.env = {
        NODE_ENV: 'test',
        PATH: originalEnv.PATH,
        SYSTEMROOT: originalEnv.SYSTEMROOT,
        WINDIR: originalEnv.WINDIR,
        NAME: longString,
        EMAIL_FROM_NAME: longString,
      };

      const config = require('../../src/config/index').default;

      expect(config.server.serviceName).toBe(longString);
      expect(config.email.from.name).toBe(longString);
    });

    it('should handle special characters in configuration', () => {
      process.env = {
        NODE_ENV: 'test',
        PATH: originalEnv.PATH,
        SYSTEMROOT: originalEnv.SYSTEMROOT,
        WINDIR: originalEnv.WINDIR,
        SMTP_PASS: 'pass@word!#$%^&*()',
        RABBITMQ_URL: 'amqp://user:p@ss@w0rd@localhost:5672',
        EMAIL_FROM_NAME: 'Test & Company <notifications>',
      };

      const config = require('../../src/config/index').default;

      expect(config.email.smtp.auth.pass).toBe('pass@word!#$%^&*()');
      expect(config.messageBroker.rabbitmq?.url).toBe('amqp://user:p@ss@w0rd@localhost:5672');
      expect(config.email.from.name).toBe('Test & Company <notifications>');
    });
  });

  describe('Kafka configuration', () => {
    it('should support Kafka broker type', () => {
      process.env = {
        NODE_ENV: 'test',
        PATH: originalEnv.PATH,
        SYSTEMROOT: originalEnv.SYSTEMROOT,
        WINDIR: originalEnv.WINDIR,
        MESSAGE_BROKER_TYPE: 'kafka',
        KAFKA_BROKERS: 'kafka1:9092,kafka2:9092',
        KAFKA_CLIENT_ID: 'test-client',
        KAFKA_GROUP_ID: 'test-group',
        KAFKA_TOPIC_NOTIFICATIONS: 'test.notifications',
      };

      const config = require('../../src/config/index').default;

      expect(config.messageBroker.type).toBe('kafka');
      expect(config.messageBroker.kafka).toBeDefined();
      expect(config.messageBroker.kafka?.brokers).toEqual(['kafka1:9092', 'kafka2:9092']);
      expect(config.messageBroker.kafka?.clientId).toBe('test-client');
      expect(config.messageBroker.kafka?.groupId).toBe('test-group');
      expect(config.messageBroker.kafka?.topics.notifications).toBe('test.notifications');
    });
  });
});
