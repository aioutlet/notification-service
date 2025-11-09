/**
 * Integration test for NotificationService with TemplateService
 * Tests the full flow of rendering notifications with templates
 */

import NotificationService from '../../src/services/notification.service';
import TemplateService from '../../src/services/template.service';
import { NotificationEvent } from '../../src/events/event-types';

// Mock logger
jest.mock('../../src/observability/logging/index.js');
import logger from '../../src/observability/logging/index.js';

describe('NotificationService Integration', () => {
  let notificationService: NotificationService;

  beforeEach(() => {
    jest.clearAllMocks();
    notificationService = new NotificationService();
  });

  describe('End-to-end notification rendering', () => {
    it('should render auth.user.registered notification with real template', async () => {
      const eventData: NotificationEvent = {
        eventType: 'auth.user.registered',
        userId: 'user-123',
        userEmail: 'john.doe@example.com',
        timestamp: new Date().toISOString(),
        data: {
          name: 'John Doe',
        },
      };

      const result = await notificationService.renderNotification(eventData, 'email');

      expect(result.subject).toBe('Welcome to AI Outlet!');
      expect(result.message).toContain('Hello John Doe');
      expect(result.message).toContain('Welcome to AI Outlet');
      expect(result.message).toContain('successfully created');
    });

    it('should render auth.email.verification.requested with real template', async () => {
      const eventData: NotificationEvent = {
        eventType: 'auth.email.verification.requested',
        userId: 'user-123',
        userEmail: 'john.doe@example.com',
        username: 'johndoe',
        timestamp: new Date().toISOString(),
        data: {
          verificationUrl: 'https://example.com/verify/abc123',
        },
      };

      const result = await notificationService.renderNotification(eventData, 'email');

      expect(result.subject).toBe('Verify your email address');
      expect(result.message).toContain('Hello johndoe');
      expect(result.message).toContain('https://example.com/verify/abc123');
      expect(result.message).toContain('verify your email');
    });

    it('should render auth.password.reset.requested with real template', async () => {
      const eventData: NotificationEvent = {
        eventType: 'auth.password.reset.requested',
        userId: 'user-123',
        userEmail: 'jane.smith@example.com',
        username: 'janesmith',
        timestamp: new Date().toISOString(),
        data: {
          resetUrl: 'https://example.com/reset/xyz789',
        },
      };

      const result = await notificationService.renderNotification(eventData, 'email');

      expect(result.subject).toBe('Reset your password');
      expect(result.message).toContain('Hello janesmith');
      expect(result.message).toContain('https://example.com/reset/xyz789');
      expect(result.message).toContain('password reset');
    });

    it('should render order.placed notification with real template', async () => {
      const eventData: NotificationEvent = {
        eventType: 'order.placed',
        userId: 'user-456',
        userEmail: 'customer@example.com',
        timestamp: new Date().toISOString(),
        data: {
          orderNumber: 'ORD-12345',
          orderId: 'ord-abc-123',
          amount: '149.99',
        },
      };

      const result = await notificationService.renderNotification(eventData, 'email');

      expect(result.subject).toBe('Order Confirmed - #ORD-12345');
      expect(result.message).toContain('order #ORD-12345');
      expect(result.message).toContain('ord-abc-123');
      expect(result.message).toContain('$149.99');
    });

    it('should render payment.received notification with real template', async () => {
      const eventData: NotificationEvent = {
        eventType: 'payment.received',
        userId: 'user-789',
        userEmail: 'buyer@example.com',
        timestamp: new Date().toISOString(),
        data: {
          amount: '99.99',
          orderId: 'ord-xyz-456',
          paymentId: 'pay-123',
        },
      };

      const result = await notificationService.renderNotification(eventData, 'email');

      expect(result.subject).toBe('Payment Received');
      expect(result.message).toContain('$99.99');
      expect(result.message).toContain('ord-xyz-456');
      expect(result.message).toContain('pay-123');
    });

    it('should handle custom event without template', async () => {
      const eventData: NotificationEvent = {
        eventType: 'custom.event.notification',
        userId: 'user-999',
        userEmail: 'user@example.com',
        timestamp: new Date().toISOString(),
        data: {
          customField: 'custom value',
          anotherField: 'another value',
        },
      };

      const result = await notificationService.renderNotification(eventData, 'email');

      expect(result.subject).toBe('Custom Event Notification');
      expect(result.message).toContain('Custom Event Notification notification');
      expect(result.message).toContain('customField');
      expect(result.message).toContain('custom value');
    });

    it('should render auth.password.reset.completed notification', async () => {
      const eventData: NotificationEvent = {
        eventType: 'auth.password.reset.completed',
        userId: 'user-111',
        userEmail: 'reset@example.com',
        username: 'resetuser',
        timestamp: new Date().toISOString(),
      };

      const result = await notificationService.renderNotification(eventData, 'email');

      expect(result.subject).toBe('Your password has been reset');
      expect(result.message).toContain('Hello resetuser');
      expect(result.message).toContain('password has been successfully reset');
    });

    it('should render order.cancelled notification', async () => {
      const eventData: NotificationEvent = {
        eventType: 'order.cancelled',
        userId: 'user-222',
        userEmail: 'cancel@example.com',
        timestamp: new Date().toISOString(),
        data: {
          orderNumber: 'ORD-99999',
          orderId: 'ord-cancelled-1',
        },
      };

      const result = await notificationService.renderNotification(eventData, 'email');

      expect(result.subject).toBe('Order Cancelled - #ORD-99999');
      expect(result.message).toContain('order #ORD-99999');
      expect(result.message).toContain('cancelled');
    });

    it('should render order.delivered notification', async () => {
      const eventData: NotificationEvent = {
        eventType: 'order.delivered',
        userId: 'user-333',
        userEmail: 'delivered@example.com',
        timestamp: new Date().toISOString(),
        data: {
          orderNumber: 'ORD-77777',
          orderId: 'ord-delivered-1',
        },
      };

      const result = await notificationService.renderNotification(eventData, 'email');

      expect(result.subject).toBe('Your order has been delivered - #ORD-77777');
      expect(result.message).toContain('order #ORD-77777');
      expect(result.message).toContain('delivered');
    });

    it('should render payment.failed notification', async () => {
      const eventData: NotificationEvent = {
        eventType: 'payment.failed',
        userId: 'user-444',
        userEmail: 'failed@example.com',
        timestamp: new Date().toISOString(),
        data: {
          amount: '199.99',
          orderId: 'ord-failed-1',
          reason: 'Insufficient funds',
        },
      };

      const result = await notificationService.renderNotification(eventData, 'email');

      expect(result.subject).toBe('Payment Failed');
      expect(result.message).toContain('$199.99');
      expect(result.message).toContain('ord-failed-1');
      expect(result.message).toContain('Insufficient funds');
      expect(result.message).toContain('failed');
    });
  });

  describe('Variable resolution from different sources', () => {
    it('should use variables from event data property', async () => {
      const eventData: NotificationEvent = {
        eventType: 'auth.user.registered',
        userId: 'user-123',
        userEmail: 'test@example.com',
        timestamp: new Date().toISOString(),
        data: {
          name: 'Alice Johnson',
        },
      };

      const result = await notificationService.renderNotification(eventData, 'email');

      expect(result.message).toContain('Alice Johnson');
    });

    it('should use variables from root level properties', async () => {
      const eventData: NotificationEvent = {
        eventType: 'auth.email.verification.requested',
        userId: 'user-123',
        userEmail: 'test@example.com',
        username: 'testuser',
        timestamp: new Date().toISOString(),
        data: {
          verificationUrl: 'https://test.com/verify',
        },
      };

      const result = await notificationService.renderNotification(eventData, 'email');

      expect(result.message).toContain('testuser');
      expect(result.message).toContain('https://test.com/verify');
    });

    it('should override root level variables with data property variables', async () => {
      const eventData: NotificationEvent = {
        eventType: 'auth.user.registered',
        userId: 'user-123',
        userEmail: 'test@example.com',
        name: 'Root Name', // This should be overridden
        timestamp: new Date().toISOString(),
        data: {
          name: 'Data Name', // This should take precedence
        },
      };

      const result = await notificationService.renderNotification(eventData, 'email');

      expect(result.message).toContain('Data Name');
      expect(result.message).not.toContain('Root Name');
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle events with minimal data', async () => {
      const eventData: NotificationEvent = {
        eventType: 'auth.user.registered',
        userId: 'user-123',
        userEmail: 'minimal@example.com',
        timestamp: new Date().toISOString(),
      };

      const result = await notificationService.renderNotification(eventData, 'email');

      expect(result).toBeDefined();
      expect(result.subject).toBe('Welcome to AI Outlet!');
      expect(result.message).toBeDefined();
    });

    it('should handle events with extra unexpected fields', async () => {
      const eventData: any = {
        eventType: 'auth.user.registered',
        userId: 'user-123',
        userEmail: 'extra@example.com',
        timestamp: new Date().toISOString(),
        unexpectedField: 'should not break anything',
        anotherField: 123,
        data: {
          name: 'Test User',
        },
      };

      const result = await notificationService.renderNotification(eventData, 'email');

      expect(result).toBeDefined();
      expect(result.subject).toBe('Welcome to AI Outlet!');
    });

    it('should log successful template rendering', async () => {
      const eventData: NotificationEvent = {
        eventType: 'auth.user.registered',
        userId: 'user-123',
        userEmail: 'log@example.com',
        timestamp: new Date().toISOString(),
        data: {
          name: 'Log Test',
        },
      };

      await notificationService.renderNotification(eventData, 'email');

      expect(logger.info).toHaveBeenCalledWith(
        '📄 Notification rendered with template:',
        expect.objectContaining({
          eventType: 'auth.user.registered',
          userId: 'user-123',
        })
      );
    });

    it('should log warning for missing template', async () => {
      const eventData: NotificationEvent = {
        eventType: 'nonexistent.event',
        userId: 'user-123',
        userEmail: 'missing@example.com',
        timestamp: new Date().toISOString(),
      };

      await notificationService.renderNotification(eventData, 'email');

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringMatching(/No template found for event: nonexistent.event/)
      );
    });
  });

  describe('Performance', () => {
    it('should render notification quickly', async () => {
      const eventData: NotificationEvent = {
        eventType: 'auth.user.registered',
        userId: 'user-123',
        userEmail: 'perf@example.com',
        timestamp: new Date().toISOString(),
        data: {
          name: 'Performance Test',
        },
      };

      const startTime = Date.now();
      await notificationService.renderNotification(eventData, 'email');
      const duration = Date.now() - startTime;

      // Should complete in less than 100ms
      expect(duration).toBeLessThan(100);
    });

    it('should handle multiple renders consecutively', async () => {
      const events: NotificationEvent[] = [
        {
          eventType: 'auth.user.registered',
          userId: 'user-1',
          userEmail: 'user1@example.com',
          timestamp: new Date().toISOString(),
          data: { name: 'User 1' },
        },
        {
          eventType: 'order.placed',
          userId: 'user-2',
          userEmail: 'user2@example.com',
          timestamp: new Date().toISOString(),
          data: { orderNumber: 'ORD-1', orderId: 'ord-1', amount: '50' },
        },
        {
          eventType: 'payment.received',
          userId: 'user-3',
          userEmail: 'user3@example.com',
          timestamp: new Date().toISOString(),
          data: { amount: '75', orderId: 'ord-3', paymentId: 'pay-3' },
        },
      ];

      const results = await Promise.all(
        events.map((event) => notificationService.renderNotification(event, 'email'))
      );

      expect(results).toHaveLength(3);
      expect(results[0].subject).toBe('Welcome to AI Outlet!');
      expect(results[1].subject).toBe('Order Confirmed - #ORD-1');
      expect(results[2].subject).toBe('Payment Received');
    });
  });
});
