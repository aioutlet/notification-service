import nodemailer from 'nodemailer';
import EmailService from '../../../src/services/email.service.js';
import config from '../../../src/core/config.js';

// Mock dependencies
jest.mock('nodemailer');
jest.mock('../../../src/core/logger.js');
jest.mock('../../../src/core/config.js');

// Import after mocking
import logger from '../../../src/core/logger.js';

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
        address: 'noreply@xshopai.com',
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
    });

    it('should send email successfully with all parameters', async () => {
      const mockInfo = { messageId: 'test-message-id' };
      mockTransporter.sendMail.mockResolvedValue(mockInfo);

      const result = await emailService.sendNotificationEmail(
        'user@example.com',
        'Test Subject',
        'Test message content',
        'ORDER_CREATED',
        { orderId: '12345' }
      );

      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: '"AI Outlet" <noreply@xshopai.com>',
        to: 'user@example.com',
        subject: 'Test Subject',
        text: 'Test message content',
        html: expect.stringContaining('Test message content'),
      });
      expect(logger.info).toHaveBeenCalledWith(
        '📧 Email sent successfully:',
        expect.objectContaining({
          to: 'user@example.com',
          subject: 'Test Subject',
          messageId: 'test-message-id',
        })
      );
    });

    it('should send email with minimal parameters (no eventData)', async () => {
      const mockInfo = { messageId: 'test-message-id' };
      mockTransporter.sendMail.mockResolvedValue(mockInfo);

      const result = await emailService.sendNotificationEmail(
        'user@example.com',
        'Test Subject',
        'Test message content',
        'ORDER_CREATED'
      );

      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.not.stringContaining('Event Details:'),
        })
      );
    });

    it('should generate proper HTML content with event data', async () => {
      const mockInfo = { messageId: 'test-message-id' };
      mockTransporter.sendMail.mockResolvedValue(mockInfo);

      await emailService.sendNotificationEmail(
        'user@example.com',
        'Test Subject',
        'Your order has been created',
        'ORDER_CREATED',
        { orderId: '12345', amount: 99.99 }
      );

      const sentEmail = mockTransporter.sendMail.mock.calls[0][0];
      expect(sentEmail.html).toContain('Your order has been created');
      expect(sentEmail.html).toContain('Event: ORDER_CREATED');
      expect(sentEmail.html).toContain('<!DOCTYPE html>');
      expect(sentEmail.html).toContain('AI Outlet Notification');
    });

    it('should return false when service is disabled', async () => {
      mockedConfig.email.enabled = false;
      const disabledService = new EmailService();

      const result = await disabledService.sendNotificationEmail(
        'user@example.com',
        'Test Subject',
        'Test message',
        'ORDER_CREATED'
      );

      expect(result).toBe(false);
      expect(mockTransporter.sendMail).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith('📧 Email sending skipped (service disabled)');
    });

    it('should handle email sending errors', async () => {
      const mockError = new Error('SMTP connection failed');
      mockTransporter.sendMail.mockRejectedValue(mockError);

      const result = await emailService.sendNotificationEmail(
        'user@example.com',
        'Test Subject',
        'Test message',
        'ORDER_CREATED'
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

    it('should handle service-level errors gracefully', async () => {
      // Simulate an error in the service method itself
      const brokenService = new EmailService();
      jest.spyOn(brokenService as any, 'generateEmailHTML').mockImplementation(() => {
        throw new Error('Template generation failed');
      });

      const result = await brokenService.sendNotificationEmail(
        'user@example.com',
        'Test Subject',
        'Test message',
        'ORDER_CREATED'
      );

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith('❌ Failed to send notification email:', expect.any(Error));
    });
  });

  describe('testEmailService', () => {
    let emailService: EmailService;

    beforeEach(() => {
      emailService = new EmailService();
    });

    it('should return true when SMTP connection test succeeds', async () => {
      mockTransporter.verify.mockResolvedValue(true);

      const result = await emailService.testEmailService();

      expect(result).toBe(true);
      expect(mockTransporter.verify).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('✅ SMTP connection test successful');
    });

    it('should return false when SMTP connection test fails', async () => {
      const mockError = new Error('SMTP verification failed');
      mockTransporter.verify.mockRejectedValue(mockError);

      const result = await emailService.testEmailService();

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith('❌ SMTP connection test failed:', mockError);
    });

    it('should return false when service is disabled', async () => {
      mockedConfig.email.enabled = false;
      const disabledService = new EmailService();

      const result = await disabledService.testEmailService();

      expect(result).toBe(false);
      expect(mockTransporter.verify).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('📧 Email service test skipped (service disabled)');
    });

    it('should allow testing with anonymous SMTP (no credentials)', async () => {
      mockedConfig.email.smtp.auth.user = '';
      const unconfiguredService = new EmailService();

      const result = await unconfiguredService.testEmailService();

      // Should still be able to test connection with anonymous SMTP
      expect(result).toBe(true);
      expect(mockTransporter.verify).toHaveBeenCalled();
    });
  });

  describe('getProviderInfo', () => {
    it('should return correct provider info when configured and enabled', () => {
      const emailService = new EmailService();

      const info = emailService.getProviderInfo();

      expect(info).toEqual({
        provider: 'smtp',
        configured: true,
        enabled: true,
      });
    });

    it('should return correct provider info when disabled', () => {
      mockedConfig.email.enabled = false;
      const emailService = new EmailService();

      const info = emailService.getProviderInfo();

      expect(info).toEqual({
        provider: 'smtp',
        configured: true,
        enabled: false,
      });
    });

    it('should return correct provider info with anonymous SMTP', () => {
      mockedConfig.email.smtp.auth.user = '';
      const emailService = new EmailService();

      const info = emailService.getProviderInfo();

      // Anonymous SMTP (Mailpit) is still configured and enabled
      expect(info).toEqual({
        provider: 'smtp',
        configured: true,
        enabled: true,
      });
    });
  });

  describe('SMTP Provider Edge Cases', () => {
    it('should handle missing credentials gracefully (allow anonymous SMTP)', () => {
      mockedConfig.email.smtp.auth.user = undefined as any;
      mockedConfig.email.smtp.auth.pass = undefined as any;

      const emailService = new EmailService();

      // Should still be enabled for anonymous SMTP
      expect(emailService.isEnabled()).toBe(true);
      expect(logger.warn).toHaveBeenCalledWith(
        '⚠️ SMTP credentials not configured. Using anonymous SMTP (suitable for Mailpit/testing).'
      );
    });

    it('should handle unknown email provider types', () => {
      mockedConfig.email.provider = 'unknown-provider';

      const emailService = new EmailService();

      expect(logger.warn).toHaveBeenCalledWith('⚠️ Unknown email provider: unknown-provider. Falling back to SMTP.');
      // Should still work with SMTP fallback
      expect(emailService.getProviderInfo().provider).toBe('unknown-provider');
    });

    it('should allow sending email with anonymous SMTP (no credentials)', async () => {
      // Create a service with missing credentials (anonymous SMTP for Mailpit)
      mockedConfig.email.smtp.auth.user = '';
      const emailService = new EmailService();

      // Mock successful email sending
      const mockInfo = { messageId: 'test-message-id' };
      mockTransporter.sendMail.mockResolvedValue(mockInfo);

      const result = await emailService.sendNotificationEmail(
        'user@example.com',
        'Test Subject',
        'Test message',
        'ORDER_CREATED'
      );

      // Should successfully send with anonymous SMTP
      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalled();
    });
  });

  describe('HTML Email Generation', () => {
    let emailService: EmailService;

    beforeEach(() => {
      emailService = new EmailService();
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test' });
    });

    it('should generate HTML with proper structure and styling', async () => {
      await emailService.sendNotificationEmail(
        'user@example.com',
        'Test Subject',
        'Test message content',
        'ORDER_CREATED'
      );

      const sentEmail = mockTransporter.sendMail.mock.calls[0][0];
      const html = sentEmail.html;

      // Check HTML structure
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html>');
      expect(html).toContain('<head>');
      expect(html).toContain('<body>');
      expect(html).toContain('</html>');

      // Check content elements
      expect(html).toContain('🔔 AI Outlet Notification');
      expect(html).toContain('Event: ORDER_CREATED');
      expect(html).toContain('Test message content');
      expect(html).toContain('This is an automated notification');

      // Check styling
      expect(html).toContain('font-family: Arial, sans-serif');
      expect(html).toContain('background-color: #4CAF50');
    });

    it('should include event data in HTML when provided', async () => {
      const eventData = {
        orderId: '12345',
        customerName: 'John Doe',
        amount: 99.99,
      };

      await emailService.sendNotificationEmail(
        'user@example.com',
        'Test Subject',
        'Test message',
        'ORDER_CREATED',
        eventData
      );

      const sentEmail = mockTransporter.sendMail.mock.calls[0][0];
      expect(sentEmail.html).toContain('Test message');
      expect(sentEmail.html).toContain('Event: ORDER_CREATED');
      expect(sentEmail.html).toContain('<!DOCTYPE html>');
      expect(sentEmail.html).toContain('AI Outlet Notification');
    });

    it('should not include event data section when not provided', async () => {
      await emailService.sendNotificationEmail('user@example.com', 'Test Subject', 'Test message', 'ORDER_CREATED');

      const sentEmail = mockTransporter.sendMail.mock.calls[0][0];
      expect(sentEmail.html).not.toContain('Event Details:');
    });
  });
});
