/**
 * Payment Service Event Consumer
 * Handles payment-related events from payment service
 */

import { DaprServer } from '@dapr/dapr';
import logger from '../../core/logger.js';
import config from '../../core/config.js';
import { EventTypes } from '../event-types.js';
import NotificationService from '../../services/notification.service.js';

export class PaymentEventConsumer {
  private daprServer: DaprServer;
  private readonly pubsubName: string;
  private notificationService: NotificationService;

  constructor(daprServer: DaprServer) {
    this.daprServer = daprServer;
    this.pubsubName = config.dapr.pubsubName;
    this.notificationService = new NotificationService();
  }

  /**
   * Register payment event subscriptions
   */
  async registerSubscriptions(): Promise<void> {
    const eventTypes = [EventTypes.PAYMENT_RECEIVED, EventTypes.PAYMENT_FAILED];

    for (const eventType of eventTypes) {
      await this.daprServer.pubsub.subscribe(this.pubsubName, eventType, async (data: any) => {
        await this.notificationService.processNotificationEvent(data, eventType);
      });

      logger.info(`Subscribed to: ${eventType}`);
    }
  }
}
