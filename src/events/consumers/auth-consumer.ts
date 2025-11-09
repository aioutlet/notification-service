/**
 * Auth Service Event Consumer
 * Handles authentication-related events from auth service
 */

import { DaprServer } from '@dapr/dapr';
import logger from '../../core/logger.js';
import config from '../../core/config.js';
import { EventTypes } from '../event-types.js';
import NotificationService from '../../services/notification.service.js';

export class AuthEventConsumer {
  private daprServer: DaprServer;
  private readonly pubsubName: string;
  private notificationService: NotificationService;

  constructor(daprServer: DaprServer) {
    this.daprServer = daprServer;
    this.pubsubName = config.dapr.pubsubName;
    this.notificationService = new NotificationService();
  }

  /**
   * Register auth event subscriptions
   */
  async registerSubscriptions(): Promise<void> {
    const eventTypes = [
      EventTypes.AUTH_USER_REGISTERED,
      EventTypes.AUTH_EMAIL_VERIFICATION_REQUESTED,
      EventTypes.AUTH_PASSWORD_RESET_REQUESTED,
      EventTypes.AUTH_PASSWORD_RESET_COMPLETED,
    ];

    for (const eventType of eventTypes) {
      await this.daprServer.pubsub.subscribe(this.pubsubName, eventType, async (data: any) => {
        await this.notificationService.processNotificationEvent(data, eventType);
      });

      logger.info(`Subscribed to: ${eventType}`);
    }
  }
}
