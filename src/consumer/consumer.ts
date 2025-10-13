/**
 * Notification Consumer
 * Consumes messages from message broker and sends notifications
 * This is the primary function of the notification service
 */

// Initialize observability modules first
import '../shared/observability/logging/logger.js';
import '../shared/observability/tracing/setup.js';

import Logger from '../shared/observability/logging/logger.js';
import { MessageBrokerFactory } from '../shared/messaging/MessageBrokerFactory.js';
import { IMessageBroker } from '../shared/messaging/IMessageBroker.js';
import DatabaseService from '../shared/services/database.service.js';
import config from '../shared/config/index.js';
import { registerEventHandlers } from './handlers/index.js';

const logger = new Logger();

let messageBroker: IMessageBroker;
let isShuttingDown = false;

/**
 * Start the notification consumer
 */
const startConsumer = async (): Promise<void> => {
  try {
    logger.info('🚀 Starting Notification Consumer...');
    logger.info(
      `📍 Service: ${process.env.SERVICE_NAME || 'notification-service'} v${process.env.SERVICE_VERSION || '1.0.0'}`
    );
    logger.info(`🌍 Environment: ${config.server.env}`);

    // Test database connection
    const dbService = DatabaseService.getInstance();
    await dbService.testConnection();
    logger.info('✅ Database connection established');

    // Create and connect message broker
    logger.info(`🔌 Connecting to message broker (${process.env.MESSAGE_BROKER_TYPE || 'rabbitmq'})...`);
    messageBroker = MessageBrokerFactory.create();
    await messageBroker.connect();
    logger.info('✅ Message broker connected');

    // Register event handlers
    registerEventHandlers(messageBroker);
    logger.info('📝 Event handlers registered');

    // Start consuming messages
    await messageBroker.startConsuming();
    logger.info('👂 Consumer started consuming messages');
    logger.info('🎯 Notification consumer is ready to process events');
  } catch (error) {
    logger.error('❌ Failed to start notification consumer:', error);
    process.exit(1);
  }
};

/**
 * Graceful shutdown handler
 */
const gracefulShutdown = async (signal: string): Promise<void> => {
  if (isShuttingDown) {
    logger.warn('⚠️  Shutdown already in progress, forcing exit...');
    process.exit(1);
  }

  isShuttingDown = true;
  logger.info(`🛑 Received ${signal}, starting graceful shutdown...`);

  try {
    // Close message broker connection
    if (messageBroker) {
      await messageBroker.close();
      logger.info('📦 Message broker connection closed');
    }

    logger.info('✅ Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
};

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // For nodemon

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('💥 Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('💥 Unhandled Rejection at:', { promise, reason });
  gracefulShutdown('UNHANDLED_REJECTION');
});

// Start the consumer
startConsumer();
