/**
 * Notification Service Application
 * Main application logic for consuming and processing notification events via Dapr
 */

import logger from './core/logger.js';
import config from './core/config.js';
import daprClient from './core/dapr.js';
import { startHealthServer, initializeDaprServer } from './health.js';
import { EventConsumerCoordinator } from './events/consumers/index.js';

let eventConsumer: EventConsumerCoordinator;
let isShuttingDown = false;
const isDaprEnabled = daprClient.isDaprEnabled();

/**
 * Start the notification consumer
 */
export const startConsumer = async (): Promise<void> => {
  try {
    logger.info('Starting Notification Consumer', {
      service: config.service.name,
      version: config.service.version,
      environment: config.service.nodeEnv,
      daprEnabled: isDaprEnabled,
    });

    if (!isDaprEnabled) {
      logger.error('Dapr is disabled - notification service requires Dapr to run');
      process.exit(1);
    }

    // Start health check server (required for Dapr subscriptions)
    startHealthServer();

    // Initialize Dapr for event-driven communication
    logger.info('Initializing Dapr server');
    const daprServer = await initializeDaprServer();

    eventConsumer = new EventConsumerCoordinator(daprServer);
    await eventConsumer.registerSubscriptions();

    await daprServer.start();
    logger.info('Consumer ready - processing events via Dapr pub/sub');
  } catch (error) {
    logger.error('Failed to start notification consumer', { error });
    process.exit(1);
  }
};

/**
 * Graceful shutdown handler
 */
const gracefulShutdown = async (signal: string): Promise<void> => {
  if (isShuttingDown) {
    logger.warn('Shutdown already in progress - forcing exit');
    process.exit(1);
  }

  isShuttingDown = true;
  logger.info('Starting graceful shutdown', { signal });

  try {
    logger.info('Dapr server shutdown handled by Dapr runtime');
    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', { error });
    process.exit(1);
  }
};

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // For nodemon

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error });
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason, promise });
  gracefulShutdown('UNHANDLED_REJECTION');
});

// Start the consumer
startConsumer();
