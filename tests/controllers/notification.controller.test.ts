import { Request, Response } from 'express';
import { createSuccessResponse } from '../../src/api/middlewares/validation.middleware';
import ErrorResponse from '../../src/shared/utils/ErrorResponse';
import { AuthRequest } from '../../src/api/middlewares/auth.middleware';

// Mock dependencies
jest.mock('../../src/shared/observability/logging/index.js');
jest.mock('../../src/api/middlewares/validation.middleware');

// Mock the services before importing the controller
const mockNotificationService = {
  createNotification: jest.fn(),
  updateNotificationStatus: jest.fn(),
  getNotificationsByUser: jest.fn(),
  getNotificationById: jest.fn(),
  getNotificationStats: jest.fn(),
  getAllNotifications: jest.fn(),
};

const mockEmailService = {
  sendNotificationEmail: jest.fn(),
  getProviderInfo: jest.fn(),
};

jest.mock('../../src/shared/services/notification.service', () => {
  return jest.fn().mockImplementation(() => mockNotificationService);
});

jest.mock('../../src/shared/services/email.service', () => {
  return jest.fn().mockImplementation(() => mockEmailService);
});

// Import after mocking
import {
  sendNotification,
  getUserNotifications,
  getNotificationById,
  getNotificationStats,
  getNotifications,
  testEmailService,
} from '../../src/api/controllers/notification.controller';
import logger from '../../src/shared/observability/logging/index.js';

const mockCreateSuccessResponse = createSuccessResponse as jest.MockedFunction<typeof createSuccessResponse>;

describe('Notification Controller', () => {
  // Create mock response object
  const mockResponse = () => {
    const res = {} as Response;
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  // Create mock request object
  const mockRequest = (overrides: Partial<Request> = {}) => {
    const req = {
      body: {},
      params: {},
      query: {},
      ip: '127.0.0.1',
      path: '/test',
      ...overrides,
    } as Request;
    return req;
  };

  // Create mock AuthRequest object
  const mockAuthRequest = (overrides: Partial<AuthRequest> = {}) => {
    const req = {
      body: {},
      params: {},
      query: {},
      ip: '127.0.0.1',
      path: '/test',
      user: {
        id: 'user123',
        role: 'user',
      },
      ...overrides,
    } as AuthRequest;
    return req;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset the mock function implementations
    mockNotificationService.createNotification.mockReset();
    mockNotificationService.updateNotificationStatus.mockReset();
    mockNotificationService.getNotificationsByUser.mockReset();
    mockNotificationService.getNotificationById.mockReset();
    mockNotificationService.getNotificationStats.mockReset();
    mockNotificationService.getAllNotifications.mockReset();

    mockEmailService.sendNotificationEmail.mockReset();
    mockEmailService.getProviderInfo.mockReset();
  });

  describe('sendNotification', () => {
    it('should create and save notification successfully', async () => {
      const req = mockRequest({
        body: {
          eventType: 'ORDER_CREATED',
          userId: 'user123',
          userEmail: 'test@example.com',
          data: { orderId: 'order123' },
          channel: 'email',
        },
      });
      const res = mockResponse();

      const mockNotificationId = 'notification123';
      const mockSuccessResponse = {
        success: true,
        message: 'Test notification created',
        data: { notificationId: mockNotificationId },
        timestamp: new Date().toISOString(),
      };

      mockNotificationService.createNotification.mockResolvedValue(mockNotificationId);
      mockNotificationService.updateNotificationStatus.mockResolvedValue(undefined);
      mockCreateSuccessResponse.mockReturnValue(mockSuccessResponse);

      await sendNotification(req, res);

      expect(logger.info).toHaveBeenCalledWith('Send notification endpoint accessed (TESTING ONLY)');
      expect(logger.warn).toHaveBeenCalledWith('⚠️ TESTING: Manual notification triggered via REST API');
      expect(mockNotificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'ORDER_CREATED',
          userId: 'user123',
          userEmail: 'test@example.com',
          data: { orderId: 'order123' },
          timestamp: expect.any(Date),
        }),
        'email'
      );
      expect(mockNotificationService.updateNotificationStatus).toHaveBeenCalledWith(mockNotificationId, 'sent');
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(mockSuccessResponse);
    });

    it('should use default channel when not provided', async () => {
      const req = mockRequest({
        body: {
          eventType: 'ORDER_CREATED',
          userId: 'user123',
          userEmail: 'test@example.com',
          data: { orderId: 'order123' },
        },
      });
      const res = mockResponse();

      mockNotificationService.createNotification.mockResolvedValue('notification123');
      mockNotificationService.updateNotificationStatus.mockResolvedValue(undefined);
      mockCreateSuccessResponse.mockReturnValue({} as any);

      await sendNotification(req, res);

      expect(mockNotificationService.createNotification).toHaveBeenCalledWith(
        expect.any(Object),
        'email' // default channel
      );
    });

    it('should handle errors and rethrow them', async () => {
      const req = mockRequest({
        body: {
          eventType: 'ORDER_CREATED',
          userId: 'user123',
          userEmail: 'test@example.com',
        },
      });
      const res = mockResponse();

      const mockError = new Error('Database error');
      mockNotificationService.createNotification.mockRejectedValue(mockError);

      await expect(sendNotification(req, res)).rejects.toThrow('Database error');
      expect(logger.error).toHaveBeenCalledWith('❌ Error creating test notification:', mockError);
    });
  });

  describe('getUserNotifications', () => {
    it('should return user notifications when user accesses own data', async () => {
      const req = mockAuthRequest({
        params: { userId: 'user123' },
        query: { limit: '10', offset: '0' },
        user: { id: 'user123', role: 'user' },
      });
      const res = mockResponse();

      const mockNotifications = [
        {
          notification_id: 'notification1',
          event_type: 'ORDER_CREATED',
          user_id: 'user123',
          message: 'Your order has been created',
          channel: 'email' as const,
          status: 'sent' as const,
          attempts: 1,
        },
        {
          notification_id: 'notification2',
          event_type: 'ORDER_SHIPPED',
          user_id: 'user123',
          message: 'Your order has been shipped',
          channel: 'email' as const,
          status: 'sent' as const,
          attempts: 1,
        },
      ];

      mockNotificationService.getNotificationsByUser.mockResolvedValue(mockNotifications);

      await getUserNotifications(req, res);

      expect(mockNotificationService.getNotificationsByUser).toHaveBeenCalledWith('user123', 10, 0);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Notifications retrieved successfully',
        data: mockNotifications,
        pagination: {
          limit: 10,
          offset: 0,
          count: 2,
        },
      });
    });

    it('should return user notifications when admin accesses any user data', async () => {
      const req = mockAuthRequest({
        params: { userId: 'user456' },
        query: {},
        user: { id: 'admin123', role: 'admin' },
      });
      const res = mockResponse();

      const mockNotifications = [
        {
          notification_id: 'notification1',
          event_type: 'ORDER_CREATED',
          user_id: 'user456',
          message: 'Your order has been created',
          channel: 'email' as const,
          status: 'sent' as const,
          attempts: 1,
        },
      ];
      mockNotificationService.getNotificationsByUser.mockResolvedValue(mockNotifications);

      await getUserNotifications(req, res);

      expect(mockNotificationService.getNotificationsByUser).toHaveBeenCalledWith('user456', 50, 0); // default pagination
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should throw forbidden error when user tries to access other user data', async () => {
      const req = mockAuthRequest({
        params: { userId: 'user456' },
        user: { id: 'user123', role: 'user' },
      });
      const res = mockResponse();

      await expect(getUserNotifications(req, res)).rejects.toThrow(ErrorResponse);
      expect(logger.warn).toHaveBeenCalledWith('🚫 Unauthorized access attempt:', expect.any(Object));
    });

    it('should throw bad request error when userId is missing', async () => {
      const req = mockAuthRequest({
        params: {},
      });
      const res = mockResponse();

      await expect(getUserNotifications(req, res)).rejects.toThrow(ErrorResponse);
    });

    it('should use default pagination when not provided', async () => {
      const req = mockAuthRequest({
        params: { userId: 'user123' },
        query: {},
        user: { id: 'user123', role: 'user' },
      });
      const res = mockResponse();

      mockNotificationService.getNotificationsByUser.mockResolvedValue([]);

      await getUserNotifications(req, res);

      expect(mockNotificationService.getNotificationsByUser).toHaveBeenCalledWith('user123', 50, 0);
    });
  });

  describe('getNotificationById', () => {
    it('should return notification when found', async () => {
      const req = mockRequest({
        params: { notificationId: 'notification123' },
      });
      const res = mockResponse();

      const mockNotification = {
        notification_id: 'notification123',
        event_type: 'ORDER_CREATED',
        user_id: 'user123',
        message: 'Your order has been created',
        channel: 'email' as const,
        status: 'sent' as const,
        attempts: 1,
      };

      mockNotificationService.getNotificationById.mockResolvedValue(mockNotification);

      await getNotificationById(req, res);

      expect(mockNotificationService.getNotificationById).toHaveBeenCalledWith('notification123');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Notification retrieved successfully',
        data: mockNotification,
      });
    });

    it('should throw not found error when notification does not exist', async () => {
      const req = mockRequest({
        params: { notificationId: 'nonexistent' },
      });
      const res = mockResponse();

      mockNotificationService.getNotificationById.mockResolvedValue(null);

      await expect(getNotificationById(req, res)).rejects.toThrow(ErrorResponse);
    });

    it('should throw bad request error when notificationId is missing', async () => {
      const req = mockRequest({
        params: {},
      });
      const res = mockResponse();

      await expect(getNotificationById(req, res)).rejects.toThrow(ErrorResponse);
    });
  });

  describe('getNotificationStats', () => {
    it('should return notification stats', async () => {
      const req = mockRequest({
        query: { userId: 'user123' },
      });
      const res = mockResponse();

      const mockStats = {
        total: 100,
        sent: 90,
        failed: 5,
        pending: 5,
      };

      mockNotificationService.getNotificationStats.mockResolvedValue(mockStats);

      await getNotificationStats(req, res);

      expect(mockNotificationService.getNotificationStats).toHaveBeenCalledWith('user123');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Notification stats retrieved successfully',
        data: mockStats,
      });
    });

    it('should work without userId filter', async () => {
      const req = mockRequest({
        query: {},
      });
      const res = mockResponse();

      const mockStats = { total: 1000 };
      mockNotificationService.getNotificationStats.mockResolvedValue(mockStats);

      await getNotificationStats(req, res);

      expect(mockNotificationService.getNotificationStats).toHaveBeenCalledWith(undefined);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('getNotifications', () => {
    it('should return all notifications with default pagination and filters', async () => {
      const req = mockRequest({
        query: {},
      });
      const res = mockResponse();

      const mockNotifications = [
        {
          notification_id: 'notification1',
          event_type: 'ORDER_CREATED',
          user_id: 'user123',
          message: 'Your order has been created',
          channel: 'email' as const,
          status: 'sent' as const,
          attempts: 1,
        },
        {
          notification_id: 'notification2',
          event_type: 'ORDER_SHIPPED',
          user_id: 'user456',
          message: 'Your order has been shipped',
          channel: 'email' as const,
          status: 'sent' as const,
          attempts: 1,
        },
      ];

      mockNotificationService.getAllNotifications.mockResolvedValue(mockNotifications);

      await getNotifications(req, res);

      expect(mockNotificationService.getAllNotifications).toHaveBeenCalledWith({
        limit: 50,
        offset: 0,
        status: undefined,
        eventType: undefined,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'All notifications retrieved successfully',
        data: mockNotifications,
        pagination: {
          limit: 50,
          offset: 0,
          count: 2,
        },
        filters: {
          status: 'all',
          eventType: 'all',
        },
      });
    });

    it('should apply filters and pagination from query params', async () => {
      const req = mockRequest({
        query: {
          limit: '25',
          offset: '10',
          status: 'sent',
          eventType: 'ORDER_CREATED',
        },
      });
      const res = mockResponse();

      mockNotificationService.getAllNotifications.mockResolvedValue([]);

      await getNotifications(req, res);

      expect(mockNotificationService.getAllNotifications).toHaveBeenCalledWith({
        limit: 25,
        offset: 10,
        status: 'sent',
        eventType: 'ORDER_CREATED',
      });
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          pagination: {
            limit: 25,
            offset: 10,
            count: 0,
          },
          filters: {
            status: 'sent',
            eventType: 'ORDER_CREATED',
          },
        })
      );
    });
  });

  describe('testEmailService', () => {
    it('should send test email successfully with custom data', async () => {
      const req = mockRequest({
        body: {
          to: 'custom@example.com',
          subject: 'Custom Test',
          message: 'Custom message',
        },
        method: 'POST',
      });
      const res = mockResponse();

      const mockProviderInfo = {
        enabled: true,
        configured: true,
        provider: 'smtp',
      };

      mockEmailService.getProviderInfo.mockReturnValue(mockProviderInfo);
      mockEmailService.sendNotificationEmail.mockResolvedValue(true);

      await testEmailService(req, res);

      expect(mockEmailService.getProviderInfo).toHaveBeenCalled();
      expect(mockEmailService.sendNotificationEmail).toHaveBeenCalledWith(
        'custom@example.com',
        'Custom Test',
        'Custom message',
        'test',
        {
          source: 'manual_test_api',
          timestamp: expect.any(String),
        }
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Test email sent successfully',
        testDetails: {
          to: 'custom@example.com',
          subject: 'Custom Test',
          method: 'POST',
        },
        emailService: mockProviderInfo,
      });
    });

    it('should use default values when no body data provided', async () => {
      const req = mockRequest({
        body: {},
        method: 'POST',
      });
      const res = mockResponse();

      const mockProviderInfo = { enabled: true, configured: true, provider: 'smtp' };
      mockEmailService.getProviderInfo.mockReturnValue(mockProviderInfo);
      mockEmailService.sendNotificationEmail.mockResolvedValue(true);

      await testEmailService(req, res);

      expect(mockEmailService.sendNotificationEmail).toHaveBeenCalledWith(
        'test@example.com', // default
        '🧪 Email Service Test - AI Outlet', // default
        expect.stringContaining('This is a test email'), // default message
        'test',
        expect.any(Object)
      );
    });

    it('should throw service unavailable error when email service is disabled', async () => {
      const req = mockRequest({
        body: { to: 'test@example.com' },
      });
      const res = mockResponse();

      mockEmailService.getProviderInfo.mockReturnValue({
        enabled: false,
        configured: true,
        provider: 'smtp',
      });

      await expect(testEmailService(req, res)).rejects.toThrow(ErrorResponse);
    });

    it('should throw bad request error when email service is not configured', async () => {
      const req = mockRequest({
        body: { to: 'test@example.com' },
      });
      const res = mockResponse();

      mockEmailService.getProviderInfo.mockReturnValue({
        enabled: true,
        configured: false,
        provider: 'smtp',
      });

      await expect(testEmailService(req, res)).rejects.toThrow(ErrorResponse);
    });

    it('should return 500 status when email sending fails', async () => {
      const req = mockRequest({
        body: { to: 'test@example.com' },
      });
      const res = mockResponse();

      mockEmailService.getProviderInfo.mockReturnValue({
        enabled: true,
        configured: true,
        provider: 'smtp',
      });
      mockEmailService.sendNotificationEmail.mockResolvedValue(false);

      await testEmailService(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Failed to send test email',
        })
      );
    });
  });
});
