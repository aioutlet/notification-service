import NotificationService from '../../src/services/notification.service';
import TemplateService from '../../src/services/template.service';
import { NotificationEvent } from '../../src/events/event-types';

// Mock dependencies
jest.mock('../../src/services/template.service');
jest.mock('../../src/observability/logging/index.js');
import logger from '../../src/observability/logging/index.js';

const MockedTemplateService = TemplateService as jest.MockedClass<typeof TemplateService>;

describe('NotificationService', () => {
  let notificationService: NotificationService;
  let mockTemplateService: jest.Mocked<TemplateService>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock template service instance
    mockTemplateService = {
      getTemplate: jest.fn(),
      renderTemplate: jest.fn(),
    } as any;

    MockedTemplateService.mockImplementation(() => mockTemplateService);

    notificationService = new NotificationService();
  });

  describe('Constructor', () => {
    it('should initialize with template service', () => {
      expect(notificationService).toBeDefined();
      expect(MockedTemplateService).toHaveBeenCalledTimes(1);
    });
  });

  describe('renderNotification', () => {
    it('should render notification with template for email channel', async () => {
      const eventData: NotificationEvent = {
        eventType: 'auth.user.registered',
        userId: 'user-123',
        userEmail: 'user@example.com',
        timestamp: new Date().toISOString(),
        data: {
          username: 'testuser',
          email: 'user@example.com',
        },
      };

      const mockTemplate = {
        event_type: 'auth.user.registered',
        channel: 'email' as const,
        template_name: 'User Registration',
        subject: 'Welcome to AI Outlet!',
        message_template: 'Hello {{username}}, welcome!',
        is_active: true,
      };

      const mockRendered = {
        subject: 'Welcome to AI Outlet!',
        message: 'Hello testuser, welcome!',
      };

      mockTemplateService.getTemplate.mockResolvedValue(mockTemplate);
      mockTemplateService.renderTemplate.mockReturnValue(mockRendered);

      const result = await notificationService.renderNotification(eventData, 'email');

      expect(result).toEqual({
        subject: 'Welcome to AI Outlet!',
        message: 'Hello testuser, welcome!',
      });

      expect(mockTemplateService.getTemplate).toHaveBeenCalledWith('auth.user.registered', 'email');
      expect(mockTemplateService.renderTemplate).toHaveBeenCalledWith(
        mockTemplate,
        expect.objectContaining({
          userId: 'user-123',
          userEmail: 'user@example.com',
          username: 'testuser',
          email: 'user@example.com',
        })
      );

      expect(logger.info).toHaveBeenCalledWith(
        '📄 Notification rendered with template:',
        expect.objectContaining({
          eventType: 'auth.user.registered',
          userId: 'user-123',
          templateName: 'User Registration',
          channel: 'email',
        })
      );
    });

    it('should render notification for order.placed event', async () => {
      const eventData: NotificationEvent = {
        eventType: 'order.placed',
        userId: 'user-456',
        userEmail: 'customer@example.com',
        timestamp: new Date().toISOString(),
        data: {
          orderId: 'order-789',
          orderNumber: 'ORD-12345',
          amount: '99.99',
        },
      };

      const mockTemplate = {
        event_type: 'order.placed',
        channel: 'email' as const,
        template_name: 'Order Confirmation',
        subject: 'Order Confirmed - #{{orderNumber}}',
        message_template: 'Order #{{orderNumber}} for ${{amount}}',
        is_active: true,
      };

      const mockRendered = {
        subject: 'Order Confirmed - #ORD-12345',
        message: 'Order #ORD-12345 for $99.99',
      };

      mockTemplateService.getTemplate.mockResolvedValue(mockTemplate);
      mockTemplateService.renderTemplate.mockReturnValue(mockRendered);

      const result = await notificationService.renderNotification(eventData, 'email');

      expect(result).toEqual(mockRendered);
      expect(mockTemplateService.getTemplate).toHaveBeenCalledWith('order.placed', 'email');
    });

    it('should create basic notification when template is not found', async () => {
      const eventData: NotificationEvent = {
        eventType: 'custom.event',
        userId: 'user-123',
        userEmail: 'user@example.com',
        timestamp: new Date().toISOString(),
        data: {
          customField: 'value',
        },
      };

      mockTemplateService.getTemplate.mockResolvedValue(null);

      const result = await notificationService.renderNotification(eventData, 'email');

      expect(result.subject).toBe('Custom Event');
      expect(result.message).toContain('Custom Event notification');
      expect(result.message).toContain('customField');

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringMatching(/No template found for event: custom.event/)
      );
    });

    it('should handle SMS channel', async () => {
      const eventData: NotificationEvent = {
        eventType: 'auth.user.registered',
        userId: 'user-123',
        userEmail: 'user@example.com',
        timestamp: new Date().toISOString(),
      };

      const mockTemplate = {
        event_type: 'auth.user.registered',
        channel: 'sms' as const,
        template_name: 'SMS Registration',
        message_template: 'Welcome {{username}}!',
        is_active: true,
      };

      const mockRendered = {
        message: 'Welcome testuser!',
      };

      mockTemplateService.getTemplate.mockResolvedValue(mockTemplate);
      mockTemplateService.renderTemplate.mockReturnValue(mockRendered);

      const result = await notificationService.renderNotification(eventData, 'sms');

      expect(result).toEqual(mockRendered);
      expect(mockTemplateService.getTemplate).toHaveBeenCalledWith('auth.user.registered', 'sms');
    });

    it('should handle push channel', async () => {
      const eventData: NotificationEvent = {
        eventType: 'order.delivered',
        userId: 'user-123',
        userEmail: 'user@example.com',
        timestamp: new Date().toISOString(),
        data: {
          orderNumber: 'ORD-12345',
        },
      };

      mockTemplateService.getTemplate.mockResolvedValue(null);

      const result = await notificationService.renderNotification(eventData, 'push');

      expect(result.subject).toBe('Order Delivered');
      expect(result.message).toContain('Order Delivered notification');
    });

    it('should handle webhook channel', async () => {
      const eventData: NotificationEvent = {
        eventType: 'payment.received',
        userId: 'user-123',
        userEmail: 'user@example.com',
        timestamp: new Date().toISOString(),
      };

      mockTemplateService.getTemplate.mockResolvedValue(null);

      const result = await notificationService.renderNotification(eventData, 'webhook');

      expect(result.subject).toBe('Payment Received');
      expect(result.message).toContain('Payment Received notification');
    });

    it('should default to email channel when not specified', async () => {
      const eventData: NotificationEvent = {
        eventType: 'auth.user.registered',
        userId: 'user-123',
        userEmail: 'user@example.com',
        timestamp: new Date().toISOString(),
      };

      mockTemplateService.getTemplate.mockResolvedValue(null);

      await notificationService.renderNotification(eventData);

      expect(mockTemplateService.getTemplate).toHaveBeenCalledWith('auth.user.registered', 'email');
    });

    it('should handle template rendering errors', async () => {
      const eventData: NotificationEvent = {
        eventType: 'auth.user.registered',
        userId: 'user-123',
        userEmail: 'user@example.com',
        timestamp: new Date().toISOString(),
      };

      const mockError = new Error('Template rendering failed');
      mockTemplateService.getTemplate.mockRejectedValue(mockError);

      await expect(notificationService.renderNotification(eventData, 'email')).rejects.toThrow(
        'Template rendering failed'
      );

      expect(logger.error).toHaveBeenCalledWith('❌ Failed to render notification:', mockError);
    });

    it('should prepare template variables from root level properties', async () => {
      const eventData: NotificationEvent = {
        eventType: 'auth.email.verification.requested',
        userId: 'user-123',
        userEmail: 'user@example.com',
        username: 'testuser',
        timestamp: new Date().toISOString(),
        data: {
          verificationUrl: 'https://example.com/verify/abc123',
        },
      };

      const mockTemplate = {
        event_type: 'auth.email.verification.requested',
        channel: 'email' as const,
        template_name: 'Email Verification',
        subject: 'Verify your email',
        message_template: 'Hello {{username}}, verify at {{verificationUrl}}',
        is_active: true,
      };

      mockTemplateService.getTemplate.mockResolvedValue(mockTemplate);
      mockTemplateService.renderTemplate.mockReturnValue({
        subject: 'Verify your email',
        message: 'Hello testuser, verify at https://example.com/verify/abc123',
      });

      await notificationService.renderNotification(eventData, 'email');

      expect(mockTemplateService.renderTemplate).toHaveBeenCalledWith(
        mockTemplate,
        expect.objectContaining({
          userId: 'user-123',
          userEmail: 'user@example.com',
          username: 'testuser',
          verificationUrl: 'https://example.com/verify/abc123',
        })
      );
    });

    it('should handle event with no data property', async () => {
      const eventData: NotificationEvent = {
        eventType: 'test.event',
        userId: 'user-123',
        userEmail: 'user@example.com',
        timestamp: new Date().toISOString(),
      };

      mockTemplateService.getTemplate.mockResolvedValue(null);

      const result = await notificationService.renderNotification(eventData, 'email');

      expect(result.subject).toBe('Test Event');
      expect(result.message).toContain('Test Event notification');
    });

    it('should format multi-part event types correctly', async () => {
      const eventData: NotificationEvent = {
        eventType: 'auth.password.reset.requested',
        userId: 'user-123',
        userEmail: 'user@example.com',
        timestamp: new Date().toISOString(),
      };

      mockTemplateService.getTemplate.mockResolvedValue(null);

      const result = await notificationService.renderNotification(eventData, 'email');

      expect(result.subject).toBe('Auth Password Reset Requested');
      expect(result.message).toContain('Auth Password Reset Requested notification');
    });

    it('should include all event data in basic notification', async () => {
      const eventData: NotificationEvent = {
        eventType: 'custom.event',
        userId: 'user-123',
        userEmail: 'user@example.com',
        timestamp: new Date().toISOString(),
        data: {
          field1: 'value1',
          field2: 'value2',
          nested: {
            field3: 'value3',
          },
        },
      };

      mockTemplateService.getTemplate.mockResolvedValue(null);

      const result = await notificationService.renderNotification(eventData, 'email');

      expect(result.message).toContain('field1');
      expect(result.message).toContain('value1');
      expect(result.message).toContain('field2');
      expect(result.message).toContain('value2');
      expect(result.message).toContain('field3');
      expect(result.message).toContain('value3');
    });
  });

  describe('prepareTemplateVariables', () => {
    it('should include userPhone if provided', async () => {
      const eventData: NotificationEvent = {
        eventType: 'test.event',
        userId: 'user-123',
        userEmail: 'user@example.com',
        userPhone: '+1234567890',
        timestamp: new Date().toISOString(),
      };

      const mockTemplate = {
        event_type: 'test.event',
        channel: 'sms' as const,
        template_name: 'Test',
        message_template: 'Phone: {{userPhone}}',
        is_active: true,
      };

      mockTemplateService.getTemplate.mockResolvedValue(mockTemplate);
      mockTemplateService.renderTemplate.mockReturnValue({
        message: 'Phone: +1234567890',
      });

      await notificationService.renderNotification(eventData, 'sms');

      expect(mockTemplateService.renderTemplate).toHaveBeenCalledWith(
        mockTemplate,
        expect.objectContaining({
          userPhone: '+1234567890',
        })
      );
    });

    it('should merge data property with root level properties', async () => {
      const eventData: NotificationEvent = {
        eventType: 'test.event',
        userId: 'user-123',
        userEmail: 'user@example.com',
        username: 'rootuser',
        timestamp: new Date().toISOString(),
        data: {
          username: 'datauser', // This should override root level
          additionalField: 'value',
        },
      };

      const mockTemplate = {
        event_type: 'test.event',
        channel: 'email' as const,
        template_name: 'Test',
        message_template: '{{username}} {{additionalField}}',
        is_active: true,
      };

      mockTemplateService.getTemplate.mockResolvedValue(mockTemplate);
      mockTemplateService.renderTemplate.mockReturnValue({
        message: 'datauser value',
      });

      await notificationService.renderNotification(eventData, 'email');

      // The data property values should override root level values
      const call = mockTemplateService.renderTemplate.mock.calls[0];
      expect(call[1]).toHaveProperty('username', 'datauser');
      expect(call[1]).toHaveProperty('additionalField', 'value');
    });
  });
});
