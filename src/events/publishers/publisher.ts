/**
 * Dapr Event Publisher for Notification Service
 * Publishes notification outcome events via Dapr pub/sub
 */

import { daprClient } from '../../clients/index.js';
import logger from '../../core/logger.js';
import config from '../../core/config.js';
import { EventTypes } from '../event-types.js';

export class DaprEventPublisher {
  private readonly pubsubName: string;
  private readonly serviceName: string;

  constructor() {
    this.pubsubName = config.dapr.pubsubName;
    this.serviceName = config.service.name;
  }

  /**
   * Publish event to Dapr pub/sub
   */
  async publishEvent(
    eventType: EventTypes.NOTIFICATION_SENT | EventTypes.NOTIFICATION_FAILED,
    data: any,
    traceId: string,
    spanId?: string
  ): Promise<boolean> {
    try {
      const event = {
        specversion: '1.0',
        type: eventType,
        source: this.serviceName,
        id: data.data?.notificationId || traceId,
        time: new Date().toISOString(),
        datacontenttype: 'application/json',
        data: data,
        // W3C Trace Context
        traceparent: spanId ? `00-${traceId}-${spanId}-01` : `00-${traceId}-${'0'.repeat(16)}-01`,
      };

      const contextLogger = logger.withTraceContext(traceId, spanId);

      contextLogger.info(`Publishing event: ${eventType}`, {
        operation: 'publish_event',
        eventType,
        notificationId: data.data?.notificationId,
      });

      await daprClient.publishEvent(this.pubsubName, eventType, event);

      contextLogger.info(`Event published successfully: ${eventType}`, {
        operation: 'publish_event',
        eventType,
        businessEvent: 'EVENT_PUBLISHED',
      });

      return true;
    } catch (error) {
      const contextLogger = logger.withTraceContext(traceId, spanId);
      contextLogger.error(`Failed to publish event: ${eventType}`, {
        operation: 'publish_event',
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
    traceId: string,
    spanId?: string
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
      traceId,
      spanId
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
    traceId: string,
    spanId?: string
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
      traceId,
      spanId
    );
  }
}

export const daprPublisher = new DaprEventPublisher();
