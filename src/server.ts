import app from './app';
import config from './config/index';
import logger from './utils/logger';
import MessageConsumer from './services/message-consumer';

const messageConsumer = new MessageConsumer();

const startServer = async (): Promise<void> => {
  try {
    // Start the HTTP server
    app.listen(config.server.port, config.server.host, () => {
      logger.info(`🚀 Notification Service started successfully`);
      logger.info(`📍 Server running on http://${config.server.host}:${config.server.port}`);
      logger.info(`🌍 Environment: ${config.server.env}`);
      logger.info(`📊 Available endpoints:`);
      logger.info(`   GET / - Welcome message`);
      logger.info(`   GET /version - API version`);
      logger.info(`   GET /health - Health check`);
      logger.info(`   POST /api/notifications - Send notification (testing only)`);
    });

    // Start RabbitMQ consumer
    logger.info(`🔌 Connecting to RabbitMQ...`);
    await messageConsumer.connect();
    await messageConsumer.startConsuming();
    logger.info(`🎯 Message consumer started - listening for events`);

    // Graceful shutdown
    const gracefulShutdown = async () => {
      logger.info('Shutting down gracefully...');
      await messageConsumer.disconnect();
      process.exit(0);
    };

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer();
