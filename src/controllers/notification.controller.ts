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
    logger.warn('⚠️ TESTING: Manual notification triggered via API (not recommended for production)');
    logger.info('Processing test notification:', {
      eventType,
      userId,
      userEmail,
      userPhone,
      data,
      timestamp: new Date().toISOString(),
    });

    // Create notification event object
    const notificationEvent = {
      eventType,
      userId,
      userEmail,
      userPhone,
      timestamp: new Date(),
      data: data || {},
    };

    // Generate notification message (similar to message consumer)
    const message = generateNotificationMessage(notificationEvent);

    // Actually save to database
    const notificationId = await notificationService.createNotification(notificationEvent, message);

    // Mark as sent immediately for testing
    await notificationService.updateNotificationStatus(notificationId, 'sent');

    logger.info('✅ Test notification saved to database:', { notificationId });

    res.status(201).json({
      success: true,
      message: 'Test notification created and saved to database',
      notificationId,
      eventType,
      userId,
      status: 'sent',
      timestamp: new Date().toISOString(),
      note: 'This endpoint is for testing only. Production notifications should come from message broker events.',
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

// Helper function to generate notification messages
function generateNotificationMessage(eventData: any): string {
  switch (eventData.eventType) {
    case EventTypes.ORDER_PLACED:
      return `Your order #${eventData.data?.orderNumber || 'N/A'} has been placed successfully!`;
    case EventTypes.ORDER_DELIVERED:
      return `Your order #${eventData.data?.orderNumber || 'N/A'} has been delivered!`;
    case EventTypes.ORDER_CANCELLED:
      return `Your order #${eventData.data?.orderNumber || 'N/A'} has been cancelled.`;
    case EventTypes.PAYMENT_RECEIVED:
      return `Payment of $${eventData.data?.amount || 'N/A'} has been received for your order.`;
    case EventTypes.PAYMENT_FAILED:
      return `Payment failed for your order. Please try again.`;
    case EventTypes.PROFILE_PASSWORD_CHANGED:
      return `Your password has been changed successfully.`;
    case EventTypes.PROFILE_NOTIFICATION_PREFERENCES_UPDATED:
      return `Your notification preferences have been updated.`;
    case EventTypes.PROFILE_BANK_DETAILS_UPDATED:
      return `Your bank details have been updated successfully.`;
    default:
      return `You have a new notification: ${eventData.eventType}`;
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

export function getNotifications(req: Request, res: Response): void {
  logger.info('Get notifications endpoint accessed');

  // For now, return a simple response (we'll add database queries later)
  res.json({
    success: true,
    message: 'Notifications endpoint - deprecated, use /users/:userId/notifications instead',
    notifications: [],
  });
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
