/**
 * User Service Event Consumer
 * Handles user-related events from user service
 */

import { DaprServer } from '@dapr/dapr';
import logger from '../../core/logger.js';
import config from '../../core/config.js';
import { EventTypes } from '../event-types.js';
import NotificationService from '../../services/notification.service.js';

export class UserEventConsumer {
  private daprServer: DaprServer;
  private readonly pubsubName: string;
  private notificationService: NotificationService;

  constructor(daprServer: DaprServer) {
    this.daprServer = daprServer;
    this.pubsubName = config.dapr.pubsubName;
    this.notificationService = new NotificationService();
  }

  /**
   * Register user event subscriptions
   */
  async registerSubscriptions(): Promise<void> {
    const eventTypes = [
      EventTypes.USER_CREATED,
      EventTypes.USER_UPDATED,
      EventTypes.USER_DELETED,
      EventTypes.USER_EMAIL_VERIFIED,
      EventTypes.USER_PASSWORD_CHANGED,
      // User profile events
      EventTypes.USER_PROFILE_PASSWORD_CHANGED,
      EventTypes.USER_PROFILE_NOTIFICATION_PREFERENCES_UPDATED,
      EventTypes.USER_PROFILE_BANK_DETAILS_UPDATED,
    ];

    for (const eventType of eventTypes) {
      await this.daprServer.pubsub.subscribe(this.pubsubName, eventType, async (data: any) => {
        await this.notificationService.processNotificationEvent(data, eventType);
      });

      logger.info(`Subscribed to: ${eventType}`);
    }
  }
}
