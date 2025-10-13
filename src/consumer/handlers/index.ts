/**
 * Event Handlers for Notification Worker
 * Registers all event handlers with the message broker
 */

import { IMessageBroker } from '../../shared/messaging/IMessageBroker.js';
import NotificationService from '../../shared/services/notification.service.js';
import EmailService from '../../shared/services/email.service.js';
import Logger from '../../shared/observability/logging/logger.js';
import { EventTypes } from '../../shared/events/event-types.js';

const logger = new Logger();
const notificationService = new NotificationService();
const emailService = new EmailService();

/**
 * Generic notification handler
 * Processes notification events and sends emails
 */
const handleNotificationEvent = async (eventData: any, correlationId: string): Promise<void> => {
  const startTime = Date.now();

  logger.info('📨 Received notification event', null, {
    operation: 'process_notification_event',
    correlationId,
    eventType: eventData.eventType,
    userId: eventData.userId || eventData.email,
  });

  try {
    // Ensure userId is set for database insertion (required field)
    // For auth events without userId, use email or username as identifier
    if (!eventData.userId && (eventData.email || eventData.username)) {
      eventData.userId = eventData.email || eventData.username;
    }

    // Validate event structure
    if (!eventData.eventType) {
      logger.warn('⚠️  Invalid event structure, missing eventType', null, {
        correlationId,
      });
      return;
    }

    // Check if it's a supported event type
    if (!Object.values(EventTypes).includes(eventData.eventType)) {
      logger.warn(`⚠️  Unsupported event type: ${eventData.eventType}`, null, {
        correlationId,
        eventType: eventData.eventType,
      });
      return;
    }

    // Save notification to database first (with template rendering)
    const notificationId = await notificationService.createNotification(eventData, 'email');

    logger.info('📤 Processing notification', null, {
      operation: 'send_notification',
      correlationId,
      businessEvent: 'NOTIFICATION_CREATED',
      notificationId,
      userId: eventData.userId,
      eventType: eventData.eventType,
      duration: Date.now() - startTime,
    });

    // Get the saved notification record to access rendered content
    const notification = await notificationService.getNotificationById(notificationId);

    if (!notification) {
      throw new Error('Failed to retrieve saved notification');
    }

    // Send actual email notification
    let emailSent = false;
    const recipientEmail = eventData.userEmail || eventData.email;

    if (recipientEmail && emailService.isEnabled()) {
      emailSent = await emailService.sendNotificationEmail(
        recipientEmail,
        notification.subject || 'Notification',
        notification.message,
        eventData.eventType,
        eventData.data
      );

      if (emailSent) {
        await notificationService.updateNotificationStatus(notificationId, 'sent');

        logger.info('✅ Email notification sent successfully', null, {
          operation: 'send_email',
          correlationId,
          businessEvent: 'EMAIL_SENT',
          notificationId,
          email: recipientEmail,
          eventType: eventData.eventType,
          duration: Date.now() - startTime,
        });
      } else {
        await notificationService.updateNotificationStatus(notificationId, 'failed', 'Email sending failed');

        logger.error('❌ Failed to send email notification', null, {
          operation: 'send_email',
          correlationId,
          notificationId,
          error: new Error('Email sending failed'),
          duration: Date.now() - startTime,
        });
      }
    } else {
      await notificationService.updateNotificationStatus(
        notificationId,
        'failed',
        'No email address or email service disabled'
      );

      logger.warn('⚠️  Email notification skipped', null, {
        correlationId,
        notificationId,
        hasEmail: !!recipientEmail,
        emailEnabled: emailService.isEnabled(),
      });
    }
  } catch (error) {
    logger.error('❌ Failed to process notification event', null, {
      operation: 'process_notification_event',
      correlationId,
      eventType: eventData.eventType,
      error: error instanceof Error ? error : new Error(String(error)),
      duration: Date.now() - startTime,
    });
    throw error; // Re-throw to trigger retry mechanism
  }
};

/**
 * Register all event handlers with the message broker
 */
export const registerEventHandlers = (messageBroker: IMessageBroker): void => {
  logger.info('📝 Registering event handlers...');

  // Register handlers for all event types
  // Auth events
  messageBroker.registerEventHandler(EventTypes.AUTH_USER_REGISTERED, handleNotificationEvent);
  messageBroker.registerEventHandler(EventTypes.AUTH_LOGIN, handleNotificationEvent);
  messageBroker.registerEventHandler(EventTypes.AUTH_EMAIL_VERIFICATION_REQUESTED, handleNotificationEvent);
  messageBroker.registerEventHandler(EventTypes.AUTH_PASSWORD_RESET_REQUESTED, handleNotificationEvent);
  messageBroker.registerEventHandler(EventTypes.AUTH_PASSWORD_RESET_COMPLETED, handleNotificationEvent);
  messageBroker.registerEventHandler(EventTypes.AUTH_ACCOUNT_REACTIVATION_REQUESTED, handleNotificationEvent);

  // User events
  messageBroker.registerEventHandler(EventTypes.USER_CREATED, handleNotificationEvent);
  messageBroker.registerEventHandler(EventTypes.USER_UPDATED, handleNotificationEvent);
  messageBroker.registerEventHandler(EventTypes.USER_DELETED, handleNotificationEvent);
  messageBroker.registerEventHandler(EventTypes.USER_EMAIL_VERIFIED, handleNotificationEvent);
  messageBroker.registerEventHandler(EventTypes.USER_PASSWORD_CHANGED, handleNotificationEvent);

  // Order events
  messageBroker.registerEventHandler(EventTypes.ORDER_PLACED, handleNotificationEvent);
  messageBroker.registerEventHandler(EventTypes.ORDER_CANCELLED, handleNotificationEvent);
  messageBroker.registerEventHandler(EventTypes.ORDER_DELIVERED, handleNotificationEvent);

  // Payment events
  messageBroker.registerEventHandler(EventTypes.PAYMENT_RECEIVED, handleNotificationEvent);
  messageBroker.registerEventHandler(EventTypes.PAYMENT_FAILED, handleNotificationEvent);

  // Profile events
  messageBroker.registerEventHandler(EventTypes.PROFILE_PASSWORD_CHANGED, handleNotificationEvent);
  messageBroker.registerEventHandler(EventTypes.PROFILE_NOTIFICATION_PREFERENCES_UPDATED, handleNotificationEvent);
  messageBroker.registerEventHandler(EventTypes.PROFILE_BANK_DETAILS_UPDATED, handleNotificationEvent);

  logger.info('✅ Event handlers registered successfully');
  logger.info('📋 Registered: Auth (6), User (5), Order (3), Payment (2), Profile (3)');
};
