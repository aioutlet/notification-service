import nodemailer from 'nodemailer';
import EmailService from '../../src/services/email.service';
import config from '../../src/config/index';

// Mock dependencies
jest.mock('nodemailer');
jest.mock('../../src/observability/logging/index.js');
jest.mock('../../src/config/index');

// Import after mocking
import logger from '../../src/observability/logging/index.js';

// Type the mocked modules
const mockedNodemailer = nodemailer as jest.Mocked<typeof nodemailer>;
const mockedConfig = config as jest.Mocked<typeof config>;

// Mock transporter
const mockTransporter = {
  sendMail: jest.fn(),
  verify: jest.fn(),
};

describe('EmailService', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Reset all mock functions
    mockTransporter.sendMail.mockReset();
    mockTransporter.verify.mockReset();

    // Setup nodemailer mock
    mockedNodemailer.createTransport.mockReturnValue(mockTransporter as any);

    // Setup default config
    mockedConfig.email = {
      enabled: true,
      provider: 'smtp',
      smtp: {
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        auth: {
          user: 'test@example.com',
          pass: 'password123',
        },
      },
      from: {
        name: 'AI Outlet',
        address: 'noreply@aioutlet.com',
      },
    };
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with email service enabled and properly configured', () => {
      const emailService = new EmailService();

      expect(emailService.isEnabled()).toBe(true);
      expect(emailService.getProviderInfo()).toEqual({
        provider: 'smtp',
        configured: true,
        enabled: true,
      });
      expect(logger.info).toHaveBeenCalledWith('✅ SMTP email provider initialized successfully');
    });

    it('should disable service when email is disabled in config', () => {
      mockedConfig.email.enabled = false;

      const emailService = new EmailService();

      expect(emailService.isEnabled()).toBe(false);
      expect(logger.info).toHaveBeenCalledWith('📧 Email service is disabled via configuration');
    });

    it('should allow anonymous SMTP when credentials are missing (for Mailpit/testing)', () => {
      mockedConfig.email.smtp.auth.user = '';
      mockedConfig.email.smtp.auth.pass = '';

      const emailService = new EmailService();

      // Service should still be enabled for anonymous SMTP (Mailpit support)
      expect(emailService.isEnabled()).toBe(true);
      expect(logger.warn).toHaveBeenCalledWith(
        '⚠️ SMTP credentials not configured. Using anonymous SMTP (suitable for Mailpit/testing).'
      );
    });

    it('should handle transporter initialization errors', () => {
      mockedNodemailer.createTransport.mockImplementation(() => {
        throw new Error('SMTP configuration error');
      });

      const emailService = new EmailService();

      expect(emailService.isEnabled()).toBe(false);
      expect(logger.error).toHaveBeenCalledWith('❌ Failed to initialize SMTP transporter:', expect.any(Error));
    });
  });

  describe('sendNotificationEmail', () => {
    let emailService: EmailService;

    beforeEach(() => {
      emailService = new EmailService();
      jest.clearAllMocks();
    });

    it('should send email successfully', async () => {
      const mockInfo = { messageId: 'test-message-id' };
      mockTransporter.sendMail.mockResolvedValue(mockInfo as any);

      const result = await emailService.sendNotificationEmail(
        'user@example.com',
        'Test Subject',
        'Test message content',
        'test.event'
      );

      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: '"AI Outlet" <noreply@aioutlet.com>',
          to: 'user@example.com',
          subject: 'Test Subject',
          text: 'Test message content',
          html: expect.any(String),
        })
      );
      expect(logger.info).toHaveBeenCalledWith(
        '📧 Email sent successfully:',
        expect.objectContaining({
          to: 'user@example.com',
          subject: 'Test Subject',
          messageId: 'test-message-id',
        })
      );
    });

    it('should return false when email service is disabled', async () => {
      mockedConfig.email.enabled = false;
      const disabledEmailService = new EmailService();

      const result = await disabledEmailService.sendNotificationEmail(
        'user@example.com',
        'Test Subject',
        'Test message',
        'test.event'
      );

      expect(result).toBe(false);
      expect(mockTransporter.sendMail).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith('📧 Email sending skipped (service disabled)');
    });

    it('should handle email sending failures', async () => {
      const mockError = new Error('SMTP connection failed');
      mockTransporter.sendMail.mockRejectedValue(mockError);

      const result = await emailService.sendNotificationEmail(
        'user@example.com',
        'Test Subject',
        'Test message',
        'test.event'
      );

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        '❌ Failed to send email:',
        expect.objectContaining({
          to: 'user@example.com',
          subject: 'Test Subject',
          error: 'SMTP connection failed',
        })
      );
    });

    it('should generate HTML content from plain text', async () => {
      const mockInfo = { messageId: 'test-message-id' };
      mockTransporter.sendMail.mockResolvedValue(mockInfo as any);

      await emailService.sendNotificationEmail(
        'user@example.com',
        'Test Subject',
        'Test message with https://example.com',
        'test.event'
      );

      const sendMailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(sendMailCall.html).toContain('<!DOCTYPE html>');
      expect(sendMailCall.html).toContain('Test message with');
      expect(sendMailCall.html).toContain('https://example.com');
    });
  });

  describe('testEmailService', () => {
    let emailService: EmailService;

    beforeEach(() => {
      emailService = new EmailService();
      jest.clearAllMocks();
    });

    it('should test connection successfully', async () => {
      mockTransporter.verify.mockResolvedValue(true as any);

      const result = await emailService.testEmailService();

      expect(result).toBe(true);
      expect(mockTransporter.verify).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('✅ SMTP connection test successful');
    });

    it('should handle connection test failure', async () => {
      const mockError = new Error('Connection refused');
      mockTransporter.verify.mockRejectedValue(mockError);

      const result = await emailService.testEmailService();

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith('❌ SMTP connection test failed:', mockError);
    });

    it('should return false when email service is disabled', async () => {
      mockedConfig.email.enabled = false;
      const disabledEmailService = new EmailService();

      const result = await disabledEmailService.testEmailService();

      expect(result).toBe(false);
      expect(mockTransporter.verify).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('📧 Email service test skipped (service disabled)');
    });
  });

  describe('getProviderInfo', () => {
    it('should return correct provider information when enabled', () => {
      const emailService = new EmailService();

      const info = emailService.getProviderInfo();

      expect(info).toEqual({
        provider: 'smtp',
        configured: true,
        enabled: true,
      });
    });

    it('should return correct provider information when disabled', () => {
      mockedConfig.email.enabled = false;
      const emailService = new EmailService();

      const info = emailService.getProviderInfo();

      expect(info).toEqual({
        provider: 'smtp',
        configured: true,
        enabled: false,
      });
    });

    it('should show not configured when provider fails to initialize', () => {
      mockedNodemailer.createTransport.mockImplementation(() => {
        throw new Error('SMTP configuration error');
      });

      const emailService = new EmailService();
      const info = emailService.getProviderInfo();

      expect(info.configured).toBe(false);
      expect(info.enabled).toBe(false);
    });
  });

  describe('HTML content generation', () => {
    let emailService: EmailService;

    beforeEach(() => {
      emailService = new EmailService();
      jest.clearAllMocks();
    });

    it('should convert URLs to clickable links', async () => {
      const mockInfo = { messageId: 'test-message-id' };
      mockTransporter.sendMail.mockResolvedValue(mockInfo as any);

      await emailService.sendNotificationEmail(
        'user@example.com',
        'Test Subject',
        'Visit https://example.com for more info',
        'test.event'
      );

      const sendMailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(sendMailCall.html).toContain('<a href="https://example.com"');
      expect(sendMailCall.html).toContain('https://example.com</a>');
    });

    it('should convert newlines to <br> tags', async () => {
      const mockInfo = { messageId: 'test-message-id' };
      mockTransporter.sendMail.mockResolvedValue(mockInfo as any);

      await emailService.sendNotificationEmail(
        'user@example.com',
        'Test Subject',
        'Line 1\nLine 2\nLine 3',
        'test.event'
      );

      const sendMailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(sendMailCall.html).toContain('Line 1<br>Line 2<br>Line 3');
    });

    it('should escape HTML special characters', async () => {
      const mockInfo = { messageId: 'test-message-id' };
      mockTransporter.sendMail.mockResolvedValue(mockInfo as any);

      await emailService.sendNotificationEmail(
        'user@example.com',
        'Test Subject',
        '<script>alert("xss")</script>',
        'test.event'
      );

      const sendMailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(sendMailCall.html).toContain('&lt;script&gt;');
      expect(sendMailCall.html).toContain('&lt;/script&gt;');
      expect(sendMailCall.html).not.toContain('<script>');
    });
  });
});
