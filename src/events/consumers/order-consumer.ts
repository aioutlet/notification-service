/**
 * Order Service Event Consumer
 * Handles order-related events from order service
 */

import { DaprServer } from '@dapr/dapr';
import logger from '../../core/logger.js';
import config from '../../core/config.js';
import { EventTypes } from '../event-types.js';
import NotificationService from '../../services/notification.service.js';

export class OrderEventConsumer {
  private daprServer: DaprServer;
  private readonly pubsubName: string;
  private notificationService: NotificationService;

  constructor(daprServer: DaprServer) {
    this.daprServer = daprServer;
    this.pubsubName = config.dapr.pubsubName;
    this.notificationService = new NotificationService();
  }

  /**
   * Register order event subscriptions
   */
  async registerSubscriptions(): Promise<void> {
    const eventTypes = [EventTypes.ORDER_PLACED, EventTypes.ORDER_CANCELLED, EventTypes.ORDER_DELIVERED];

    for (const eventType of eventTypes) {
      await this.daprServer.pubsub.subscribe(this.pubsubName, eventType, async (data: any) => {
        await this.notificationService.processNotificationEvent(data, eventType);
      });

      logger.info(`Subscribed to: ${eventType}`);
    }
  }
}
