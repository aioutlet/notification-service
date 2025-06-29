import { Request, Response } from 'express';
import { EventTypes } from '../events/event-types';
import logger from '../utils/logger';
import NotificationService from '../services/notification.service';
import EmailService from '../services/email.service';
import { createSuccessResponse } from '../middlewares/validation.middleware';
import { CreateNotificationInput, NotificationFiltersInput, EmailTestInput } from '../validators/schemas';
import { AuthRequest } from '../middlewares/auth.middleware';
import ErrorResponse from '../utils/ErrorResponse';

const notificationService = new NotificationService();
const emailService = new EmailService();

export async function sendNotification(req: Request, res: Response): Promise<void> {
  try {
    logger.info('Send notification endpoint accessed (TESTING ONLY)');

    // Data is already validated by middleware
    const { eventType, userId, userEmail, userPhone, data, channel = 'email' } = req.body as CreateNotificationInput;

    logger.warn('⚠️ TESTING: Manual notification triggered via REST API');
    logger.warn('⚠️ PRODUCTION: Notifications should come from RabbitMQ message broker');

    // Create notification event object (using BaseEvent interface)
    const notificationEvent = {
      eventType,
      userId,
      userEmail,
      userPhone,
      timestamp: new Date(),
      data: data || {},
    } as any; // Type assertion to handle union type complexity

    // Save to database with template rendering (but don't send email)
    const notificationId = await notificationService.createNotification(notificationEvent, channel);

    // Mark as sent for testing purposes (actual sending happens via RabbitMQ consumer)
    await notificationService.updateNotificationStatus(notificationId, 'sent');

    logger.info('✅ Test notification saved to database with template rendering:', {
      notificationId,
      channel,
      note: 'Email sending happens via RabbitMQ consumer in production',
    });

    const response = createSuccessResponse(
      'Test notification created and saved to database with template rendering',
      {
        notificationId,
        eventType,
        userId,
        channel,
        status: 'sent',
      },
      {
        note: {
          testing: 'This endpoint is for testing template rendering and database storage only',
          production:
            'Real notifications are sent via RabbitMQ message broker → notification consumer → email delivery',
          flow: 'Order Service → RabbitMQ → Notification Service (consumer) → Email/SMS/etc',
        },
      }
    );

    res.status(201).json(response);
  } catch (error) {
    logger.error('❌ Error creating test notification:', error);
    throw error; // Let global error handler handle it
  }
}

// Get notifications for a specific user
export async function getUserNotifications(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    if (!userId) {
      throw ErrorResponse.badRequest('userId is required');
    }

    // Authorization check: Users can only access their own notifications, admins can access any
    const isAdmin = req.user?.role === 'admin';
    const isOwnData = req.user?.id === userId;

    if (!isAdmin && !isOwnData) {
      logger.warn('🚫 Unauthorized access attempt:', {
        requestedUserId: userId,
        currentUserId: req.user?.id,
        currentUserRole: req.user?.role,
        ip: req.ip,
        path: req.path,
      });
      throw ErrorResponse.forbidden('Access denied. You can only view your own notifications.');
    }

    logger.info('✅ Authorized notification access:', {
      requestedUserId: userId,
      currentUserId: req.user?.id,
      currentUserRole: req.user?.role,
      isAdmin,
      isOwnData,
    });

    const notifications = await notificationService.getNotificationsByUser(userId, limit, offset);

    res.status(200).json({
      success: true,
      message: 'Notifications retrieved successfully',
      data: notifications,
      pagination: {
        limit,
        offset,
        count: notifications.length,
      },
    });
  } catch (error) {
    logger.error('Error getting user notifications:', error);
    throw error; // Let global error handler handle it
  }
}

// Get a specific notification by ID
export async function getNotificationById(req: Request, res: Response): Promise<void> {
  try {
    const { notificationId } = req.params;

    if (!notificationId) {
      throw ErrorResponse.badRequest('notificationId is required');
    }

    const notification = await notificationService.getNotificationById(notificationId);

    if (!notification) {
      throw ErrorResponse.notFound('Notification not found');
    }

    res.status(200).json({
      success: true,
      message: 'Notification retrieved successfully',
      data: notification,
    });
  } catch (error) {
    logger.error('Error getting notification by ID:', error);
    throw error; // Let global error handler handle it
  }
}

// Get notification statistics
export async function getNotificationStats(req: Request, res: Response): Promise<void> {
  try {
    const { userId } = req.query;

    const stats = await notificationService.getNotificationStats(userId as string);

    res.status(200).json({
      success: true,
      message: 'Notification stats retrieved successfully',
      data: stats,
    });
  } catch (error) {
    logger.error('Error getting notification stats:', error);
    throw error; // Let global error handler handle it
  }
}

export async function getNotifications(req: Request, res: Response): Promise<void> {
  try {
    logger.info('Get all notifications endpoint accessed');

    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const status = req.query.status as string;
    const eventType = req.query.eventType as string;

    // Get all notifications with optional filters
    const notifications = await notificationService.getAllNotifications({
      limit,
      offset,
      status,
      eventType,
    });

    res.status(200).json({
      success: true,
      message: 'All notifications retrieved successfully',
      data: notifications,
      pagination: {
        limit,
        offset,
        count: notifications.length,
      },
      filters: {
        status: status || 'all',
        eventType: eventType || 'all',
      },
    });
  } catch (error) {
    logger.error('Error getting all notifications:', error);
    throw error; // Let global error handler handle it
  }
}

// Test email service endpoint
export async function testEmailService(req: Request, res: Response): Promise<void> {
  try {
    // Use request body with sensible defaults for POST request
    const to = req.body?.to || 'test@example.com';
    const subject = req.body?.subject || '🧪 Email Service Test - AI Outlet';
    const message =
      req.body?.message ||
      'This is a test email from the AI Outlet Notification Service. If you received this, the email service is working correctly! 🎉';

    logger.info('Testing email service via API:', { to, subject, method: req.method });

    // First check if email service is configured and enabled
    const providerInfo = emailService.getProviderInfo();
    if (!providerInfo.enabled) {
      throw ErrorResponse.serviceUnavailable('Email service is disabled. Check EMAIL_ENABLED in configuration.');
    }

    if (!providerInfo.configured) {
      throw ErrorResponse.badRequest('Email service is not properly configured. Check SMTP settings.');
    }

    const emailSent = await emailService.sendNotificationEmail(to, subject, message, 'test', {
      source: 'manual_test_api',
      timestamp: new Date().toISOString(),
    });

    res.status(emailSent ? 200 : 500).json({
      success: emailSent,
      message: emailSent ? 'Test email sent successfully' : 'Failed to send test email',
      testDetails: {
        to,
        subject,
        method: req.method,
      },
      emailService: providerInfo,
    });
  } catch (error) {
    logger.error('Error testing email service:', error);
    throw error; // Let global error handler handle it
  }
}
