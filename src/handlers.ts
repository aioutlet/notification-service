/**
 * Event Handlers for Notification Worker
 * Registers all event handlers with the message broker
 */

import { IMessageBroker } from './messaging/IMessageBroker.js';
import NotificationService from './services/notification.service.js';
import EmailService from './services/email.service.js';
import Logger from './observability/logging/logger.js';
import { EventTypes } from './events/event-types.js';
import { v4 as uuidv4 } from 'uuid';

const logger = new Logger();
const notificationService = new NotificationService();
const emailService = new EmailService();

/**
 * Generic notification handler
 * Processes notification events and sends emails
 * Publishes notification outcome events for audit-service to consume
 */
const handleNotificationEvent = async (
  eventData: any,
  correlationId: string,
  messageBroker: IMessageBroker
): Promise<void> => {
  const startTime = Date.now();
  const notificationId = uuidv4();

  logger.info('📨 Received notification event', null, {
    operation: 'process_notification_event',
    correlationId,
    eventType: eventData.eventType,
    userId: eventData.userId || eventData.email,
    notificationId,
  });

  try {
    // Ensure userId is set (required field)
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

    // Render notification content from template
    const renderedNotification = await notificationService.renderNotification(eventData, 'email');

    logger.info('📤 Processing notification', null, {
      operation: 'send_notification',
      correlationId,
      businessEvent: 'NOTIFICATION_PROCESSING',
      notificationId,
      userId: eventData.userId,
      eventType: eventData.eventType,
    });

    // Send actual email notification
    let emailSent = false;
    const recipientEmail = eventData.userEmail || eventData.email;

    if (recipientEmail && emailService.isEnabled()) {
      emailSent = await emailService.sendNotificationEmail(
        recipientEmail,
        renderedNotification.subject || 'Notification',
        renderedNotification.message,
        eventData.eventType,
        eventData.data
      );

      if (emailSent) {
        // Publish NOTIFICATION_SENT event for audit-service
        await messageBroker.publishEvent(
          EventTypes.NOTIFICATION_SENT,
          {
            eventType: EventTypes.NOTIFICATION_SENT,
            userId: eventData.userId,
            userEmail: recipientEmail,
            timestamp: new Date(),
            data: {
              notificationId,
              originalEventType: eventData.eventType,
              channel: 'email',
              recipientEmail,
              subject: renderedNotification.subject,
              attemptNumber: 1,
            },
          },
          correlationId
        );

        logger.info('✅ Email notification sent successfully', null, {
          operation: 'send_email',
          correlationId,
          businessEvent: 'NOTIFICATION_SENT',
          notificationId,
          email: recipientEmail,
          eventType: eventData.eventType,
          duration: Date.now() - startTime,
        });
      } else {
        // Publish NOTIFICATION_FAILED event for audit-service
        await messageBroker.publishEvent(
          EventTypes.NOTIFICATION_FAILED,
          {
            eventType: EventTypes.NOTIFICATION_FAILED,
            userId: eventData.userId,
            userEmail: recipientEmail,
            timestamp: new Date(),
            data: {
              notificationId,
              originalEventType: eventData.eventType,
              channel: 'email',
              recipientEmail,
              subject: renderedNotification.subject,
              errorMessage: 'Email sending failed',
              attemptNumber: 1,
            },
          },
          correlationId
        );

        logger.error('❌ Failed to send email notification', null, {
          operation: 'send_email',
          correlationId,
          businessEvent: 'NOTIFICATION_FAILED',
          notificationId,
          error: new Error('Email sending failed'),
          duration: Date.now() - startTime,
        });
      }
    } else {
      // Publish NOTIFICATION_FAILED event for missing email or disabled service
      await messageBroker.publishEvent(
        EventTypes.NOTIFICATION_FAILED,
        {
          eventType: EventTypes.NOTIFICATION_FAILED,
          userId: eventData.userId,
          userEmail: recipientEmail,
          timestamp: new Date(),
          data: {
            notificationId,
            originalEventType: eventData.eventType,
            channel: 'email',
            recipientEmail,
            subject: renderedNotification.subject,
            errorMessage: 'No email address or email service disabled',
            attemptNumber: 1,
          },
        },
        correlationId
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
      notificationId,
      error: error instanceof Error ? error : new Error(String(error)),
      duration: Date.now() - startTime,
    });
    throw error; // Re-throw to trigger retry mechanism
  }
};

/**
 * Register all event handlers with the message broker
 */
export const registerEventHandlers = async (messageBroker: IMessageBroker): Promise<void> => {
  logger.info('📝 Registering event handlers...');

  // Create a wrapper that passes messageBroker to the handler
  const createHandler = (handler: typeof handleNotificationEvent) => {
    return (eventData: any, correlationId: string) => handler(eventData, correlationId, messageBroker);
  };

  // Register handlers for all event types
  // Auth events
  await messageBroker.registerEventHandler(EventTypes.AUTH_USER_REGISTERED, createHandler(handleNotificationEvent));
  await messageBroker.registerEventHandler(
    EventTypes.AUTH_EMAIL_VERIFICATION_REQUESTED,
    createHandler(handleNotificationEvent)
  );
  await messageBroker.registerEventHandler(
    EventTypes.AUTH_PASSWORD_RESET_REQUESTED,
    createHandler(handleNotificationEvent)
  );
  await messageBroker.registerEventHandler(
    EventTypes.AUTH_PASSWORD_RESET_COMPLETED,
    createHandler(handleNotificationEvent)
  );

  // User events
  await messageBroker.registerEventHandler(EventTypes.USER_CREATED, createHandler(handleNotificationEvent));
  await messageBroker.registerEventHandler(EventTypes.USER_UPDATED, createHandler(handleNotificationEvent));
  await messageBroker.registerEventHandler(EventTypes.USER_DELETED, createHandler(handleNotificationEvent));
  await messageBroker.registerEventHandler(EventTypes.USER_EMAIL_VERIFIED, createHandler(handleNotificationEvent));
  await messageBroker.registerEventHandler(EventTypes.USER_PASSWORD_CHANGED, createHandler(handleNotificationEvent));

  // Order events
  await messageBroker.registerEventHandler(EventTypes.ORDER_PLACED, createHandler(handleNotificationEvent));
  await messageBroker.registerEventHandler(EventTypes.ORDER_CANCELLED, createHandler(handleNotificationEvent));
  await messageBroker.registerEventHandler(EventTypes.ORDER_DELIVERED, createHandler(handleNotificationEvent));

  // Payment events
  await messageBroker.registerEventHandler(EventTypes.PAYMENT_RECEIVED, createHandler(handleNotificationEvent));
  await messageBroker.registerEventHandler(EventTypes.PAYMENT_FAILED, createHandler(handleNotificationEvent));

  // Profile events
  await messageBroker.registerEventHandler(EventTypes.PROFILE_PASSWORD_CHANGED, createHandler(handleNotificationEvent));
  await messageBroker.registerEventHandler(
    EventTypes.PROFILE_NOTIFICATION_PREFERENCES_UPDATED,
    createHandler(handleNotificationEvent)
  );
  await messageBroker.registerEventHandler(
    EventTypes.PROFILE_BANK_DETAILS_UPDATED,
    createHandler(handleNotificationEvent)
  );

  logger.info('✅ Event handlers registered successfully');
  logger.info('📋 Registered: Auth (6), User (5), Order (3), Payment (2), Profile (3)');
};
