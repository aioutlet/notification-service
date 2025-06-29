import { Request, Response } from 'express';
import { EventTypes } from '../events/event-types';
import logger from '../utils/logger';
import NotificationService from '../services/notification.service';
import EmailService from '../services/email.service';

const notificationService = new NotificationService();
const emailService = new EmailService();

export async function sendNotification(req: Request, res: Response): Promise<void> {
  try {
    logger.info('Send notification endpoint accessed (TESTING ONLY)');

    const { eventType, userId, userEmail, userPhone, data } = req.body;

    // Basic validation
    if (!eventType || !userId) {
      res.status(400).json({
        success: false,
        message: 'eventType and userId are required',
      });
      return;
    }

    // Validate event type
    if (!Object.values(EventTypes).includes(eventType)) {
      res.status(400).json({
        success: false,
        message: 'Invalid event type',
        validEventTypes: Object.values(EventTypes),
      });
      return;
    }

    // For testing only - simulate manual event injection
    logger.warn('⚠️ TESTING: Manual notification triggered via REST API');
    logger.warn('⚠️ PRODUCTION: Notifications should come from RabbitMQ message broker');

    // Create notification event object
    const notificationEvent = {
      eventType,
      userId,
      userEmail,
      userPhone,
      timestamp: new Date(),
      data: data || {},
    };

    const channel = req.body.channel || 'email'; // Default to email

    // Save to database with template rendering (but don't send email)
    const notificationId = await notificationService.createNotification(notificationEvent, channel);

    // Mark as sent for testing purposes (actual sending happens via RabbitMQ consumer)
    await notificationService.updateNotificationStatus(notificationId, 'sent');

    logger.info('✅ Test notification saved to database with template rendering:', {
      notificationId,
      channel,
      note: 'Email sending happens via RabbitMQ consumer in production',
    });

    res.status(201).json({
      success: true,
      message: 'Test notification created and saved to database with template rendering',
      notificationId,
      eventType,
      userId,
      channel,
      status: 'sent',
      timestamp: new Date().toISOString(),
      note: {
        testing: 'This endpoint is for testing template rendering and database storage only',
        production: 'Real notifications are sent via RabbitMQ message broker → notification consumer → email delivery',
        flow: 'Order Service → RabbitMQ → Notification Service (consumer) → Email/SMS/etc',
      },
    });
  } catch (error) {
    logger.error('❌ Error creating test notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create notification',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// Get notifications for a specific user
export async function getUserNotifications(req: Request, res: Response): Promise<void> {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'userId is required',
      });
      return;
    }

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
    res.status(500).json({
      success: false,
      message: 'Failed to get notifications',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// Get a specific notification by ID
export async function getNotificationById(req: Request, res: Response): Promise<void> {
  try {
    const { notificationId } = req.params;

    if (!notificationId) {
      res.status(400).json({
        success: false,
        message: 'notificationId is required',
      });
      return;
    }

    const notification = await notificationService.getNotificationById(notificationId);

    if (!notification) {
      res.status(404).json({
        success: false,
        message: 'Notification not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Notification retrieved successfully',
      data: notification,
    });
  } catch (error) {
    logger.error('Error getting notification by ID:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get notification',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
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
    res.status(500).json({
      success: false,
      message: 'Failed to get notification stats',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
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
    res.status(500).json({
      success: false,
      message: 'Failed to get notifications',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
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
      res.status(400).json({
        success: false,
        message: 'Email service is disabled. Check EMAIL_ENABLED in configuration.',
        emailService: providerInfo,
      });
      return;
    }

    if (!providerInfo.configured) {
      res.status(400).json({
        success: false,
        message: 'Email service is not properly configured. Check SMTP settings.',
        emailService: providerInfo,
      });
      return;
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
    res.status(500).json({
      success: false,
      message: 'Failed to test email service',
      error: error instanceof Error ? error.message : 'Unknown error',
      emailService: emailService.getProviderInfo(),
    });
  }
}
