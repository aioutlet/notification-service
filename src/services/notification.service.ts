/**
 * Notification Service (Stateless)
 *
 * This service handles notification rendering without database storage.
 * Notification outcome events are published to the message broker for audit-service to consume.
 */

import TemplateService, { TemplateVariables } from './template.service.js';
import logger from '../observability/logging/index.js';
import { NotificationEvent } from '../events/event-types.js';

export interface RenderedNotification {
  subject?: string;
  message: string;
}

class NotificationService {
  private templateService: TemplateService;

  constructor() {
    this.templateService = new TemplateService();
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
}

export default NotificationService;
