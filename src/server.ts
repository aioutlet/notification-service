// Initialize tracing FIRST - this must be the very first import
import './tracing-init.js';

import app from './app.js';
import config from './config/index.js';
import Logger from './observability/logging/logger.js';
import MessageConsumer from './services/message-consumer.js';
import DatabaseService from './services/database.service.js';
import { Server } from 'http';
import { handleUncaughtException, handleUnhandledRejection } from './middlewares/error.middleware.js';

// Create logger instance
const logger = new Logger();

// Handle uncaught exceptions and unhandled rejections
process.on('uncaughtException', handleUncaughtException);
process.on('unhandledRejection', handleUnhandledRejection);

const messageConsumer = new MessageConsumer();
let server: Server;
let isShuttingDown = false;

const startServer = async (): Promise<void> => {
  try {
    // Start the HTTP server
    server = app.listen(config.server.port, config.server.host, () => {
      logger.info(`🚀 Notification Service started successfully`);
      logger.info(`📍 Server running on http://${config.server.host}:${config.server.port}`);
      logger.info(`🌍 Environment: ${config.server.env}`);
      logger.info(`📊 Available endpoints:`);
      logger.info(`   GET /api/home/ - Welcome message`);
      logger.info(`   GET /api/home/version - API version`);
      logger.info(`   GET /api/home/health - Health check`);
      logger.info(`   GET /api/monitoring/health - Detailed health check`);
      logger.info(`   GET /api/monitoring/metrics - Service metrics`);
      logger.info(`   GET /api/monitoring/stats - Service statistics`);
      logger.info(`   POST /api/notifications - Send notification (testing only)`);
    });

    // Configure server timeout for graceful shutdown
    server.timeout = 30000; // 30 seconds
    server.keepAliveTimeout = 65000; // 65 seconds
    server.headersTimeout = 66000; // 66 seconds

    // Start RabbitMQ consumer
    logger.info(`🔌 Connecting to RabbitMQ message broker...`);
    await messageConsumer.connect();
    await messageConsumer.startConsuming();
    logger.info(`🎯 Message consumer started - listening for events`);

    // Enhanced graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      if (isShuttingDown) {
        logger.warn('💀 Force shutdown - received second signal');
        process.exit(1);
      }

      isShuttingDown = true;
      logger.info(`🛑 Received ${signal}, starting graceful shutdown...`);

      // Set a timeout for forced shutdown
      const forceShutdownTimeout = setTimeout(() => {
        logger.error('💀 Graceful shutdown timeout - forcing exit');
        process.exit(1);
      }, 30000); // 30 seconds timeout

      try {
        // Stop accepting new connections
        server.close(async () => {
          logger.info('🔌 HTTP server closed');

          // Stop RabbitMQ consumer and close connections
          logger.info('🔌 Closing RabbitMQ connections...');
          await messageConsumer.disconnect();

          // Close database connections
          logger.info('🔌 Closing database connections...');
          const dbService = DatabaseService.getInstance();
          await dbService.close();

          clearTimeout(forceShutdownTimeout);
          logger.info('✅ Graceful shutdown complete');
          process.exit(0);
        });

        // Stop processing new requests on existing connections
        server.closeAllConnections();
      } catch (error) {
        logger.error('❌ Error during graceful shutdown:', error);
        clearTimeout(forceShutdownTimeout);
        process.exit(1);
      }
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // For nodemon

    // Handle uncaught exceptions and unhandled rejections
    process.on('uncaughtException', (error) => {
      logger.error('💥 Uncaught Exception:', error);
      gracefulShutdown('UNCAUGHT_EXCEPTION');
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('💥 Unhandled Rejection', { reason, promise: String(promise) });
      gracefulShutdown('UNHANDLED_REJECTION');
    });

    // Add health check for ready status
    app.get('/ready', (req, res) => {
      if (isShuttingDown) {
        res.status(503).json({ status: 'shutting_down' });
      } else {
        res.status(200).json({ status: 'ready' });
      }
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer();
