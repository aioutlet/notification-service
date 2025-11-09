/**
 * Dapr Event Publisher for Notification Service
 * Publishes notification outcome events via Dapr pub/sub
 */

import { DaprClient } from '@dapr/dapr';
import logger from '../../core/logger.js';
import config from '../../core/config.js';
import { EventTypes } from '../event-types.js';

export class DaprEventPublisher {
  private daprClient: DaprClient;
  private readonly pubsubName: string;
  private readonly serviceName: string;

  constructor() {
    this.daprClient = new DaprClient({
      daprHost: config.dapr.host,
      daprPort: String(config.dapr.httpPort),
    });
    this.pubsubName = config.dapr.pubsubName;
    this.serviceName = config.service.name;
  }

  /**
   * Publish event to Dapr pub/sub
   */
  async publishEvent(
    eventType: EventTypes.NOTIFICATION_SENT | EventTypes.NOTIFICATION_FAILED,
    data: any,
    correlationId: string
  ): Promise<boolean> {
    try {
      const event = {
        specversion: '1.0',
        type: eventType,
        source: this.serviceName,
        id: data.data?.notificationId || correlationId,
        time: new Date().toISOString(),
        datacontenttype: 'application/json',
        data: data,
        correlationid: correlationId,
      };

      logger.info(`Publishing event: ${eventType}`, {
        operation: 'publish_event',
        correlationId,
        eventType,
        notificationId: data.data?.notificationId,
      });

      await this.daprClient.pubsub.publish(this.pubsubName, eventType, event);

      logger.info(`Event published successfully: ${eventType}`, {
        operation: 'publish_event',
        correlationId,
        eventType,
        businessEvent: 'EVENT_PUBLISHED',
      });

      return true;
    } catch (error) {
      logger.error(`Failed to publish event: ${eventType}`, {
        operation: 'publish_event',
        correlationId,
        eventType,
        error: error instanceof Error ? error : new Error(String(error)),
      });
      return false;
    }
  }

  /**
   * Publish notification.sent event
   */
  async publishNotificationSent(
    notificationId: string,
    originalEventType: string,
    userId: string,
    recipientEmail: string,
    subject: string,
    correlationId: string
  ): Promise<boolean> {
    return this.publishEvent(
      EventTypes.NOTIFICATION_SENT,
      {
        eventType: EventTypes.NOTIFICATION_SENT,
        userId,
        userEmail: recipientEmail,
        timestamp: new Date(),
        data: {
          notificationId,
          originalEventType,
          channel: 'email',
          recipientEmail,
          subject,
          attemptNumber: 1,
        },
      },
      correlationId
    );
  }

  /**
   * Publish notification.failed event
   */
  async publishNotificationFailed(
    notificationId: string,
    originalEventType: string,
    userId: string,
    recipientEmail: string | undefined,
    subject: string,
    errorMessage: string,
    correlationId: string
  ): Promise<boolean> {
    return this.publishEvent(
      EventTypes.NOTIFICATION_FAILED,
      {
        eventType: EventTypes.NOTIFICATION_FAILED,
        userId,
        userEmail: recipientEmail,
        timestamp: new Date(),
        data: {
          notificationId,
          originalEventType,
          channel: 'email',
          recipientEmail,
          subject,
          errorMessage,
          attemptNumber: 1,
        },
      },
      correlationId
    );
  }
}

export const daprPublisher = new DaprEventPublisher();
