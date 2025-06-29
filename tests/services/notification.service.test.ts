import NotificationService, { NotificationRecord } from '../../src/services/notification.service';
import DatabaseService from '../../src/services/database.service';
import TemplateService from '../../src/services/template.service';
import MonitoringService from '../../src/services/monitoring.service';
import logger from '../../src/utils/logger';
import { NotificationEvent, EventTypes } from '../../src/events/event-types';

// Mock dependencies
jest.mock('../../src/services/database.service');
jest.mock('../../src/services/template.service');
jest.mock('../../src/services/monitoring.service');
jest.mock('../../src/utils/logger');
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-123'),
}));

describe('NotificationService', () => {
  let notificationService: NotificationService;
  let mockDatabaseService: jest.Mocked<DatabaseService>;
  let mockTemplateService: jest.Mocked<TemplateService>;
  let mockMonitoringService: jest.Mocked<MonitoringService>;

  const mockNotificationRecord: NotificationRecord = {
    id: 1,
    notification_id: 'test-uuid-123',
    event_type: 'order.placed',
    user_id: 'user-123',
    recipient_email: 'test@example.com',
    subject: 'Order Placed',
    message: 'Your order has been placed successfully.',
    channel: 'email',
    status: 'pending',
    attempts: 0,
    event_data: { orderId: 'order-456', orderNumber: 'ORD-001' },
    template_id: 1,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockOrderEvent: NotificationEvent = {
    eventType: EventTypes.ORDER_PLACED,
    userId: 'user-123',
    userEmail: 'test@example.com',
    timestamp: new Date(),
    data: {
      orderId: 'order-456',
      orderNumber: 'ORD-001',
      amount: 99.99,
      items: [{ id: 1, name: 'Product 1' }],
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock instances
    mockDatabaseService = {
      query: jest.fn(),
      beginTransaction: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
      close: jest.fn(),
    } as unknown as jest.Mocked<DatabaseService>;

    mockTemplateService = {
      getTemplate: jest.fn(),
      renderTemplate: jest.fn(),
      createTemplate: jest.fn(),
      updateTemplate: jest.fn(),
      deleteTemplate: jest.fn(),
      getAllTemplates: jest.fn(),
    } as unknown as jest.Mocked<TemplateService>;

    mockMonitoringService = {
      recordNotificationSent: jest.fn(),
      recordNotificationFailed: jest.fn(),
      recordRequestDuration: jest.fn(),
      incrementCounter: jest.fn(),
      setGauge: jest.fn(),
      recordHistogram: jest.fn(),
    } as unknown as jest.Mocked<MonitoringService>;

    // Mock static getInstance methods
    (DatabaseService.getInstance as jest.Mock).mockReturnValue(mockDatabaseService);
    (MonitoringService.getInstance as jest.Mock).mockReturnValue(mockMonitoringService);

    // Mock TemplateService constructor
    (TemplateService as jest.Mock).mockImplementation(() => mockTemplateService);

    notificationService = new NotificationService();
  });

  describe('createNotification', () => {
    it('should create notification with template successfully', async () => {
      const mockTemplate = {
        id: 1,
        event_type: 'order.placed',
        channel: 'email' as const,
        template_name: 'Order Placed',
        subject: 'Order {{orderNumber}} Placed',
        message_template: 'Your order {{orderNumber}} has been placed.',
        is_active: true,
      };

      const mockRendered = {
        subject: 'Order ORD-001 Placed',
        message: 'Your order ORD-001 has been placed.',
      };

      mockTemplateService.getTemplate.mockResolvedValue(mockTemplate);
      mockTemplateService.renderTemplate.mockReturnValue(mockRendered);
      mockDatabaseService.query.mockResolvedValue([{ insertId: 1 }]);

      const result = await notificationService.createNotification(mockOrderEvent, 'email');

      expect(result).toBe('test-uuid-123');
      expect(mockTemplateService.getTemplate).toHaveBeenCalledWith('order.placed', 'email');
      expect(mockTemplateService.renderTemplate).toHaveBeenCalled();
      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO notifications'),
        expect.arrayContaining([
          'test-uuid-123',
          'order.placed',
          'user-123',
          'test@example.com',
          null, // recipient_phone
          'Order ORD-001 Placed',
          'Your order ORD-001 has been placed.',
          'email',
          'pending',
          0,
          expect.stringContaining('orderId'),
          1,
        ])
      );
      expect(mockMonitoringService.recordNotificationSent).toHaveBeenCalledWith('email', expect.any(Number));
      expect(logger.info).toHaveBeenCalledWith(
        '💾 Notification saved to database with template:',
        expect.objectContaining({
          notificationId: 'test-uuid-123',
          eventType: 'order.placed',
          userId: 'user-123',
          templateId: 1,
          channel: 'email',
        })
      );
    });

    it('should create basic notification when no template found', async () => {
      mockTemplateService.getTemplate.mockResolvedValue(null);
      mockDatabaseService.query.mockResolvedValue([{ insertId: 1 }]);

      const result = await notificationService.createNotification(mockOrderEvent, 'email');

      expect(result).toBe('test-uuid-123');
      expect(mockTemplateService.getTemplate).toHaveBeenCalledWith('order.placed', 'email');
      expect(mockTemplateService.renderTemplate).not.toHaveBeenCalled();
      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO notifications'),
        expect.arrayContaining([
          'test-uuid-123',
          'order.placed',
          'user-123',
          'test@example.com',
          null,
          'Notification: order.placed',
          'Your order order-456 has been placed successfully.',
          'email',
          'pending',
          0,
          expect.stringContaining('orderId'),
        ])
      );
      expect(logger.warn).toHaveBeenCalledWith('⚠️ No template found for event: order.placed, channel: email');
      expect(mockMonitoringService.recordNotificationSent).toHaveBeenCalledWith('email', expect.any(Number));
    });

    it('should handle payment events correctly', async () => {
      const paymentEvent: NotificationEvent = {
        eventType: EventTypes.PAYMENT_RECEIVED,
        userId: 'user-123',
        userEmail: 'test@example.com',
        timestamp: new Date(),
        data: {
          orderId: 'order-456',
          paymentId: 'pay-789',
          amount: 99.99,
        },
      };

      mockTemplateService.getTemplate.mockResolvedValue(null);
      mockDatabaseService.query.mockResolvedValue([{ insertId: 1 }]);

      await notificationService.createNotification(paymentEvent, 'email');

      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO notifications'),
        expect.arrayContaining([
          'test-uuid-123',
          'payment.received',
          'user-123',
          'test@example.com',
          null,
          'Notification: payment.received',
          'Payment of 99.99 has been received successfully.',
          'email',
          'pending',
          0,
          expect.stringContaining('paymentId'),
        ])
      );
    });

    it('should handle profile events correctly', async () => {
      const profileEvent: NotificationEvent = {
        eventType: EventTypes.PROFILE_PASSWORD_CHANGED,
        userId: 'user-123',
        userEmail: 'test@example.com',
        timestamp: new Date(),
        data: {
          field: 'password',
          oldValue: 'old-hash',
          newValue: 'new-hash',
        },
      };

      mockTemplateService.getTemplate.mockResolvedValue(null);
      mockDatabaseService.query.mockResolvedValue([{ insertId: 1 }]);

      await notificationService.createNotification(profileEvent, 'email');

      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO notifications'),
        expect.arrayContaining([
          'test-uuid-123',
          'profile.password_changed',
          'user-123',
          'test@example.com',
          null,
          'Notification: profile.password_changed',
          'Your password has been changed successfully.',
          'email',
          'pending',
          0,
          expect.stringContaining('field'),
        ])
      );
    });

    it('should handle SMS channel correctly', async () => {
      const eventWithPhone: NotificationEvent = {
        ...mockOrderEvent,
        userPhone: '+1234567890',
      };

      mockTemplateService.getTemplate.mockResolvedValue(null);
      mockDatabaseService.query.mockResolvedValue([{ insertId: 1 }]);

      await notificationService.createNotification(eventWithPhone, 'sms');

      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO notifications'),
        expect.arrayContaining([
          'test-uuid-123',
          'order.placed',
          'user-123',
          'test@example.com',
          '+1234567890',
          'Notification: order.placed',
          'Your order order-456 has been placed successfully.',
          'sms',
          'pending',
          0,
          expect.stringContaining('orderId'),
        ])
      );
    });

    it('should handle database errors properly', async () => {
      const dbError = new Error('Database connection failed');
      mockTemplateService.getTemplate.mockResolvedValue(null);
      mockDatabaseService.query.mockRejectedValue(dbError);

      await expect(notificationService.createNotification(mockOrderEvent, 'email')).rejects.toThrow(
        'Database connection failed'
      );

      expect(mockMonitoringService.recordNotificationFailed).toHaveBeenCalledWith('email', 'database_error');
      expect(logger.error).toHaveBeenCalledWith('❌ Failed to save notification to database:', dbError);
    });

    it('should handle template service errors properly', async () => {
      const templateError = new Error('Template service failed');
      mockTemplateService.getTemplate.mockRejectedValue(templateError);

      await expect(notificationService.createNotification(mockOrderEvent, 'email')).rejects.toThrow(
        'Template service failed'
      );

      expect(mockMonitoringService.recordNotificationFailed).toHaveBeenCalledWith('email', 'database_error');
      expect(logger.error).toHaveBeenCalledWith('❌ Failed to save notification to database:', templateError);
    });
  });

  describe('updateNotificationStatus', () => {
    it('should update status to sent successfully', async () => {
      mockDatabaseService.query.mockResolvedValue([{ affectedRows: 1 }]);

      await notificationService.updateNotificationStatus('test-uuid-123', 'sent');

      expect(mockDatabaseService.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE notifications'), [
        'sent',
        'test-uuid-123',
      ]);
      expect(logger.info).toHaveBeenCalledWith('📝 Notification status updated:', {
        notificationId: 'test-uuid-123',
        status: 'sent',
        errorMessage: undefined,
      });
    });

    it('should update status to failed with error message', async () => {
      mockDatabaseService.query.mockResolvedValue([{ affectedRows: 1 }]);

      await notificationService.updateNotificationStatus('test-uuid-123', 'failed', 'SMTP connection failed');

      expect(mockDatabaseService.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE notifications'), [
        'failed',
        'SMTP connection failed',
        'test-uuid-123',
      ]);
      expect(logger.info).toHaveBeenCalledWith('📝 Notification status updated:', {
        notificationId: 'test-uuid-123',
        status: 'failed',
        errorMessage: 'SMTP connection failed',
      });
    });

    it('should update status to retry', async () => {
      mockDatabaseService.query.mockResolvedValue([{ affectedRows: 1 }]);

      await notificationService.updateNotificationStatus('test-uuid-123', 'retry');

      expect(mockDatabaseService.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE notifications'), [
        'retry',
        'test-uuid-123',
      ]);
      expect(logger.info).toHaveBeenCalledWith('📝 Notification status updated:', {
        notificationId: 'test-uuid-123',
        status: 'retry',
        errorMessage: undefined,
      });
    });

    it('should handle database errors during status update', async () => {
      const dbError = new Error('Database update failed');
      mockDatabaseService.query.mockRejectedValue(dbError);

      await expect(notificationService.updateNotificationStatus('test-uuid-123', 'sent')).rejects.toThrow(
        'Database update failed'
      );

      expect(logger.error).toHaveBeenCalledWith('❌ Failed to update notification status:', dbError);
    });
  });

  describe('getNotificationById', () => {
    it('should get notification by ID successfully', async () => {
      mockDatabaseService.query.mockResolvedValue([mockNotificationRecord]);

      const result = await notificationService.getNotificationById('test-uuid-123');

      expect(result).toEqual(mockNotificationRecord);
      expect(mockDatabaseService.query).toHaveBeenCalledWith('SELECT * FROM notifications WHERE notification_id = ?', [
        'test-uuid-123',
      ]);
    });

    it('should return null when notification not found', async () => {
      mockDatabaseService.query.mockResolvedValue([]);

      const result = await notificationService.getNotificationById('non-existent');

      expect(result).toBeNull();
      expect(mockDatabaseService.query).toHaveBeenCalledWith('SELECT * FROM notifications WHERE notification_id = ?', [
        'non-existent',
      ]);
    });

    it('should handle database errors during notification fetch', async () => {
      const dbError = new Error('Database query failed');
      mockDatabaseService.query.mockRejectedValue(dbError);

      await expect(notificationService.getNotificationById('test-uuid-123')).rejects.toThrow('Database query failed');

      expect(logger.error).toHaveBeenCalledWith('❌ Failed to get notification by ID:', {
        notificationId: 'test-uuid-123',
        error: dbError,
      });
    });
  });

  describe('getAllNotifications', () => {
    it('should get all notifications with default options', async () => {
      const mockNotifications = [mockNotificationRecord];
      mockDatabaseService.query.mockResolvedValue(mockNotifications);

      const result = await notificationService.getAllNotifications();

      expect(result).toEqual(mockNotifications);
      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50 OFFSET 0'),
        []
      );
    });

    it('should get notifications with status filter', async () => {
      mockDatabaseService.query.mockResolvedValue([]);

      await notificationService.getAllNotifications({ status: 'pending' });

      expect(mockDatabaseService.query).toHaveBeenCalledWith(expect.stringContaining('WHERE status = ?'), ['pending']);
    });

    it('should get notifications with event type filter', async () => {
      mockDatabaseService.query.mockResolvedValue([]);

      await notificationService.getAllNotifications({ eventType: 'order.placed' });

      expect(mockDatabaseService.query).toHaveBeenCalledWith(expect.stringContaining('WHERE event_type = ?'), [
        'order.placed',
      ]);
    });

    it('should get notifications with multiple filters', async () => {
      mockDatabaseService.query.mockResolvedValue([]);

      await notificationService.getAllNotifications({
        status: 'pending',
        eventType: 'order.placed',
        limit: 20,
        offset: 10,
      });

      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE status = ? AND event_type = ? ORDER BY created_at DESC LIMIT 20 OFFSET 10'),
        ['pending', 'order.placed']
      );
    });

    it('should handle invalid pagination in getAllNotifications', async () => {
      mockDatabaseService.query.mockResolvedValue([]);

      await notificationService.getAllNotifications({ limit: -5, offset: -10 });

      expect(mockDatabaseService.query).toHaveBeenCalledWith(expect.stringContaining('LIMIT 1 OFFSET 0'), []);
    });

    it('should handle database errors during all notifications fetch', async () => {
      const dbError = new Error('Database query failed');
      mockDatabaseService.query.mockRejectedValue(dbError);

      await expect(notificationService.getAllNotifications()).rejects.toThrow('Database query failed');

      expect(logger.error).toHaveBeenCalledWith('❌ Failed to get all notifications:', dbError);
    });
  });

  describe('private methods (via public methods)', () => {
    describe('prepareTemplateVariables', () => {
      it('should prepare order event variables correctly', async () => {
        const mockTemplate = {
          id: 1,
          event_type: 'order.placed',
          channel: 'email' as const,
          template_name: 'Order Placed',
          subject: 'Order {{orderNumber}} - {{orderAmount}}',
          message_template: 'Order {{orderNumber}} for {{orderAmount}} has been placed.',
          is_active: true,
        };

        mockTemplateService.getTemplate.mockResolvedValue(mockTemplate);
        mockTemplateService.renderTemplate.mockImplementation((template, variables) => {
          // Verify that the variables include order-specific data
          expect(variables).toMatchObject({
            userId: 'user-123',
            userEmail: 'test@example.com',
            eventType: 'order.placed',
            orderId: 'order-456',
            orderNumber: 'ORD-001',
            orderAmount: 99.99,
            orderItems: [{ id: 1, name: 'Product 1' }],
          });
          return { subject: 'Test Subject', message: 'Test Message' };
        });
        mockDatabaseService.query.mockResolvedValue([{ insertId: 1 }]);

        await notificationService.createNotification(mockOrderEvent, 'email');

        expect(mockTemplateService.renderTemplate).toHaveBeenCalled();
      });
    });

    describe('generateBasicMessage', () => {
      it('should generate basic messages for different event types', async () => {
        mockTemplateService.getTemplate.mockResolvedValue(null);
        mockDatabaseService.query.mockResolvedValue([{ insertId: 1 }]);

        // Test order cancelled
        const orderCancelledEvent: NotificationEvent = {
          ...mockOrderEvent,
          eventType: EventTypes.ORDER_CANCELLED,
        };

        await notificationService.createNotification(orderCancelledEvent, 'email');
        expect(mockDatabaseService.query).toHaveBeenCalledWith(
          expect.anything(),
          expect.arrayContaining([
            expect.anything(),
            expect.anything(),
            expect.anything(),
            expect.anything(),
            expect.anything(),
            expect.anything(),
            'Your order order-456 has been cancelled.',
            expect.anything(),
            expect.anything(),
            expect.anything(),
            expect.anything(),
          ])
        );

        // Test payment failed
        const paymentFailedEvent: NotificationEvent = {
          eventType: EventTypes.PAYMENT_FAILED,
          userId: 'user-123',
          userEmail: 'test@example.com',
          timestamp: new Date(),
          data: {
            orderId: 'order-456',
            paymentId: 'pay-789',
            amount: 99.99,
            reason: 'Insufficient funds',
          },
        };

        await notificationService.createNotification(paymentFailedEvent, 'email');
        expect(mockDatabaseService.query).toHaveBeenCalledWith(
          expect.anything(),
          expect.arrayContaining([
            expect.anything(),
            expect.anything(),
            expect.anything(),
            expect.anything(),
            expect.anything(),
            expect.anything(),
            'Payment of 99.99 has failed. Reason: Insufficient funds',
            expect.anything(),
            expect.anything(),
            expect.anything(),
            expect.anything(),
          ])
        );
      });
    });

    describe('parseEventData', () => {
      it('should parse different event_data formats correctly', async () => {
        // Test with string JSON
        const notificationWithStringData = {
          ...mockNotificationRecord,
          event_data: '{"orderId":"order-456"}',
        };
        mockDatabaseService.query.mockResolvedValue([notificationWithStringData]);

        let result = await notificationService.getNotificationsByUser('user-123');
        expect(result[0].event_data).toEqual({ orderId: 'order-456' });

        // Test with object data
        const notificationWithObjectData = {
          ...mockNotificationRecord,
          event_data: { orderId: 'order-456' },
        };
        mockDatabaseService.query.mockResolvedValue([notificationWithObjectData]);

        result = await notificationService.getNotificationsByUser('user-123');
        expect(result[0].event_data).toEqual({ orderId: 'order-456' });

        // Test with null data
        const notificationWithNullData = {
          ...mockNotificationRecord,
          event_data: null,
        };
        mockDatabaseService.query.mockResolvedValue([notificationWithNullData]);

        result = await notificationService.getNotificationsByUser('user-123');
        expect(result[0].event_data).toBeNull();
      });
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle events with missing data gracefully', async () => {
      const eventWithoutData = {
        eventType: EventTypes.ORDER_PLACED,
        userId: 'user-123',
        userEmail: 'test@example.com',
        timestamp: new Date(),
        data: {
          orderId: '',
          orderNumber: '',
        },
      } as NotificationEvent;

      mockTemplateService.getTemplate.mockResolvedValue(null);
      mockDatabaseService.query.mockResolvedValue([{ insertId: 1 }]);

      await notificationService.createNotification(eventWithoutData, 'email');

      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.anything(),
        expect.arrayContaining([
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.anything(),
          'Your order N/A has been placed successfully.',
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.anything(),
        ])
      );
    });

    it('should handle events with partial data', async () => {
      const eventWithPartialData: NotificationEvent = {
        eventType: EventTypes.PAYMENT_FAILED,
        userId: 'user-123',
        userEmail: 'test@example.com',
        timestamp: new Date(),
        data: {
          orderId: 'order-456',
          paymentId: 'pay-789',
          amount: 99.99,
          // missing reason
        },
      };

      mockTemplateService.getTemplate.mockResolvedValue(null);
      mockDatabaseService.query.mockResolvedValue([{ insertId: 1 }]);

      await notificationService.createNotification(eventWithPartialData, 'email');

      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.anything(),
        expect.arrayContaining([
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.anything(),
          'Payment of 99.99 has failed.',
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.anything(),
        ])
      );
    });

    it('should handle unknown event types gracefully', async () => {
      const unknownEvent = {
        eventType: 'unknown.event',
        userId: 'user-123',
        userEmail: 'test@example.com',
        timestamp: new Date(),
        data: { someField: 'someValue' },
      } as any;

      mockTemplateService.getTemplate.mockResolvedValue(null);
      mockDatabaseService.query.mockResolvedValue([{ insertId: 1 }]);

      await notificationService.createNotification(unknownEvent, 'email');

      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.anything(),
        expect.arrayContaining([
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.anything(),
          'Notification: unknown.event',
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.anything(),
        ])
      );
    });
  });
});
