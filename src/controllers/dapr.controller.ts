/**
 * Dapr Integration Controller
 * Handles Dapr-specific endpoints like pub/sub subscriptions
 */

import { Request, Response } from 'express';
import logger from '../core/logger.js';
import config from '../core/config.js';
import { EventTypes } from '../events/index.js';

/**
 * Dapr subscription endpoint
 * Returns list of topics this service subscribes to
 */
export const subscribe = (req: Request, res: Response): void => {
  const subscriptions = [
    // Auth events
    {
      pubsubname: config.dapr.pubsubName,
      topic: EventTypes.AUTH_USER_REGISTERED,
      route: '/events/auth.user.registered',
    },
    {
      pubsubname: config.dapr.pubsubName,
      topic: EventTypes.AUTH_EMAIL_VERIFICATION_REQUESTED,
      route: '/events/auth.email.verification.requested',
    },
    {
      pubsubname: config.dapr.pubsubName,
      topic: EventTypes.AUTH_PASSWORD_RESET_REQUESTED,
      route: '/events/auth.password.reset.requested',
    },
    {
      pubsubname: config.dapr.pubsubName,
      topic: EventTypes.AUTH_PASSWORD_RESET_COMPLETED,
      route: '/events/auth.password.reset.completed',
    },
    // User events
    { pubsubname: config.dapr.pubsubName, topic: EventTypes.USER_CREATED, route: '/events/user.user.created' },
    { pubsubname: config.dapr.pubsubName, topic: EventTypes.USER_UPDATED, route: '/events/user.user.updated' },
    { pubsubname: config.dapr.pubsubName, topic: EventTypes.USER_DELETED, route: '/events/user.user.deleted' },
    { pubsubname: config.dapr.pubsubName, topic: EventTypes.USER_EMAIL_VERIFIED, route: '/events/user.email.verified' },
    {
      pubsubname: config.dapr.pubsubName,
      topic: EventTypes.USER_PASSWORD_CHANGED,
      route: '/events/user.password.changed',
    },
    // Order events
    { pubsubname: config.dapr.pubsubName, topic: EventTypes.ORDER_PLACED, route: '/events/order.placed' },
    { pubsubname: config.dapr.pubsubName, topic: EventTypes.ORDER_CANCELLED, route: '/events/order.cancelled' },
    { pubsubname: config.dapr.pubsubName, topic: EventTypes.ORDER_DELIVERED, route: '/events/order.delivered' },
    // Payment events
    { pubsubname: config.dapr.pubsubName, topic: EventTypes.PAYMENT_RECEIVED, route: '/events/payment.received' },
    { pubsubname: config.dapr.pubsubName, topic: EventTypes.PAYMENT_FAILED, route: '/events/payment.failed' },
    // User Profile events
    {
      pubsubname: config.dapr.pubsubName,
      topic: EventTypes.USER_PROFILE_PASSWORD_CHANGED,
      route: '/events/profile.password_changed',
    },
    {
      pubsubname: config.dapr.pubsubName,
      topic: EventTypes.USER_PROFILE_NOTIFICATION_PREFERENCES_UPDATED,
      route: '/events/profile.notification_preferences_updated',
    },
    {
      pubsubname: config.dapr.pubsubName,
      topic: EventTypes.USER_PROFILE_BANK_DETAILS_UPDATED,
      route: '/events/profile.bank_details_updated',
    },
  ];

  logger.info('Dapr subscription list requested', {
    subscriptionCount: subscriptions.length,
  });

  res.json(subscriptions);
};
