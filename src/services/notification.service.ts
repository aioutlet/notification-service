/**
 * Notification Service (Stateless)
 *
 * This service handles notification rendering without database storage.
 * Notification outcome events are published to the message broker for audit-service to consume.
 */

import TemplateService, { TemplateVariables } from './template.service.js';
import EmailService from './email.service.js';
import logger from '../core/logger.js';
import { NotificationEvent } from '../events/event-types.js';
import { daprPublisher } from '../events/publishers/index.js';
import { v4 as uuidv4 } from 'uuid';

export interface RenderedNotification {
  subject?: string;
  message: string;
}

class NotificationService {
  private templateService: TemplateService;
  private emailService: EmailService;

  constructor() {
    this.templateService = new TemplateService();
    this.emailService = new EmailService();
  }

  /**
   * Render notification content from event data using templates
   * This is a stateless operation - no database storage
   *
   * @param eventData - The notification event data
   * @param channel - The notification channel (email, sms, etc.)
   * @returns Rendered notification content
   */
  async renderNotification(
    eventData: NotificationEvent,
    channel: 'email' | 'sms' | 'push' | 'webhook' = 'email'
  ): Promise<RenderedNotification> {
    const startTime = Date.now();

    try {
      // Get the template for this event type and channel
      const template = await this.templateService.getTemplate(eventData.eventType, channel);

      if (!template) {
        logger.warn(`⚠️ No template found for event: ${eventData.eventType}, channel: ${channel}`);
        // Return a basic notification without template
        return this.createBasicNotification(eventData, channel);
      }

      // Prepare template variables from event data
      const templateVariables = this.prepareTemplateVariables(eventData);

      // Render the template
      const rendered = this.templateService.renderTemplate(template, templateVariables);

      const duration = Date.now() - startTime;

      logger.info('📄 Notification rendered with template:', {
        eventType: eventData.eventType,
        userId: eventData.userId,
        templateName: template.template_name,
        channel,
        duration: `${duration}ms`,
      });

      return {
        subject: rendered.subject,
        message: rendered.message,
      };
    } catch (error) {
      logger.error('❌ Failed to render notification:', error);
      throw error;
    }
  }

  /**
   * Create a basic notification without template
   */
  private createBasicNotification(
    eventData: NotificationEvent,
    channel: 'email' | 'sms' | 'push' | 'webhook'
  ): RenderedNotification {
    const eventTypeFormatted = eventData.eventType
      .split('.')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    let message = `${eventTypeFormatted} notification`;

    // Add basic context based on event data
    if (eventData.data) {
      const dataStr = JSON.stringify(eventData.data, null, 2);
      message += `\n\n${dataStr}`;
    }

    return {
      subject: eventTypeFormatted,
      message,
    };
  }

  /**
   * Prepare template variables from event data
   */
  private prepareTemplateVariables(eventData: NotificationEvent): TemplateVariables {
    const variables: TemplateVariables = {
      userId: eventData.userId,
      userEmail: eventData.userEmail,
      userPhone: eventData.userPhone,
      eventType: eventData.eventType,
      timestamp: eventData.timestamp,
    };

    // Spread all root-level properties from eventData
    // This handles cases where fields are sent at root level (like Auth Service events)
    Object.keys(eventData).forEach((key) => {
      if (key !== 'data' && eventData[key as keyof NotificationEvent] !== undefined) {
        variables[key] = eventData[key as keyof NotificationEvent];
      }
    });

    // Also spread data property if it exists (nested structure)
    if (eventData.data) {
      Object.assign(variables, eventData.data);
    }

    return variables;
  }

  /**
   * Process notification event - orchestrates rendering, sending, and publishing outcomes
   * This is the main entry point called by event consumers
   */
  async processNotificationEvent(cloudEvent: any, eventType: string): Promise<void> {
    const startTime = Date.now();
    const correlationId = cloudEvent.correlationid || cloudEvent.id || uuidv4();
    const notificationId = uuidv4();
    const eventData = cloudEvent.data || cloudEvent;

    logger.info(`Received notification event: ${eventType}`, {
      operation: 'process_notification_event',
      correlationId,
      eventType,
      userId: eventData.userId || eventData.email,
      notificationId,
    });

    try {
      // Ensure userId is set (required field)
      if (!eventData.userId && (eventData.email || eventData.username)) {
        eventData.userId = eventData.email || eventData.username;
      }

      // Set eventType if not present
      if (!eventData.eventType) {
        eventData.eventType = eventType;
      }

      // Validate event structure
      if (!eventData.eventType) {
        logger.warn('Invalid event structure, missing eventType', {
          correlationId,
        });
        return;
      }

      // Render notification content from template
      const renderedNotification = await this.renderNotification(eventData, 'email');

      logger.info('Processing notification', {
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

      if (recipientEmail && this.emailService.isEnabled()) {
        emailSent = await this.emailService.sendNotificationEmail(
          recipientEmail,
          renderedNotification.subject || 'Notification',
          renderedNotification.message,
          eventData.eventType,
          eventData.data
        );

        if (emailSent) {
          // Publish NOTIFICATION_SENT event via Dapr
          await daprPublisher.publishNotificationSent(
            notificationId,
            eventData.eventType,
            eventData.userId,
            recipientEmail,
            renderedNotification.subject || 'Notification',
            correlationId
          );

          logger.info('Email notification sent successfully', {
            operation: 'send_email',
            correlationId,
            businessEvent: 'NOTIFICATION_SENT',
            notificationId,
            email: recipientEmail,
            eventType: eventData.eventType,
            duration: Date.now() - startTime,
          });
        } else {
          // Publish NOTIFICATION_FAILED event via Dapr
          await daprPublisher.publishNotificationFailed(
            notificationId,
            eventData.eventType,
            eventData.userId,
            recipientEmail,
            renderedNotification.subject || 'Notification',
            'Email sending failed',
            correlationId
          );

          logger.error('Failed to send email notification', {
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
        await daprPublisher.publishNotificationFailed(
          notificationId,
          eventData.eventType,
          eventData.userId,
          recipientEmail,
          renderedNotification.subject || 'Notification',
          'No email address or email service disabled',
          correlationId
        );

        logger.warn('Email notification skipped', {
          correlationId,
          notificationId,
          hasEmail: !!recipientEmail,
          emailEnabled: this.emailService.isEnabled(),
        });
      }
    } catch (error) {
      logger.error('Failed to process notification event', {
        operation: 'process_notification_event',
        correlationId,
        eventType,
        notificationId,
        error: error instanceof Error ? error : new Error(String(error)),
        duration: Date.now() - startTime,
      });
      throw error; // Re-throw to trigger Dapr retry mechanism
    }
  }
}

export default NotificationService;
