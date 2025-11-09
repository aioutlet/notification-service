/**
 * Health Check Server
 * Provides health check and Dapr subscription endpoints
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { DaprServer } from '@dapr/dapr';
import logger from './core/logger.js';
import config from './core/config.js';
import { daprClient } from './clients/index.js';
import { EventTypes } from './events/index.js';

const app = express();
let daprServer: DaprServer | null = null;

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(cookieParser());

// Dapr subscription endpoint
// Returns list of topics this service subscribes to
app.get('/dapr/subscribe', (req, res) => {
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
});

// Health check endpoints
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: config.service.name,
    version: config.service.version,
    environment: config.service.nodeEnv,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.get('/health/ready', (req, res) => {
  res.json({
    status: 'ready',
    service: config.service.name,
    timestamp: new Date().toISOString(),
    checks: {
      server: { status: 'healthy' },
    },
  });
});

app.get('/health/live', (req, res) => {
  res.json({
    status: 'alive',
    service: config.service.name,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.get('/metrics', (req, res) => {
  const memoryUsage = process.memoryUsage();

  res.json({
    service: config.service.name,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      rss: memoryUsage.rss,
      heapTotal: memoryUsage.heapTotal,
      heapUsed: memoryUsage.heapUsed,
      external: memoryUsage.external,
    },
    nodeVersion: process.version,
    platform: process.platform,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested endpoint does not exist',
  });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('HTTP Server Error', { error: err });
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message || 'An unexpected error occurred',
  });
});

export function startHealthServer(): void {
  const PORT = config.service.port;
  const HOST = config.service.host;

  app.listen(PORT, HOST, () => {
    logger.info(`Health check server running on ${HOST}:${PORT}`);
  });
}

/**
 * Initialize Dapr server for event subscriptions
 */
export async function initializeDaprServer(): Promise<DaprServer> {
  daprServer = daprClient.getServer();

  logger.info('Dapr server initialized', {
    daprHost: config.dapr.host,
    daprPort: config.dapr.httpPort,
    appPort: config.dapr.appPort,
  });

  return daprServer;
}

export function getDaprServer(): DaprServer | null {
  return daprServer;
}
