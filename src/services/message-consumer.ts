import amqp from 'amqplib';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import { EventTypes } from '../events/event-types.js';
import NotificationService from './notification.service.js';
import DatabaseService from './database.service.js';
import EmailService from './email.service.js';

interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

interface MessageMetadata {
  retryCount?: number;
  firstFailureTime?: number;
  lastFailureTime?: number;
  originalQueue?: string;
}

class MessageConsumer {
  private connection: any = null;
  private channel: any = null;
  private notificationService: NotificationService;
  private dbService: DatabaseService;
  private emailService: EmailService;
  private isShuttingDown = false;

  // Retry configuration
  private retryConfig: RetryConfig = {
    maxRetries: 3,
    initialDelay: 1000, // 1 second
    maxDelay: 60000, // 60 seconds
    backoffMultiplier: 2,
  };

  // Queue names
  private readonly RETRY_QUEUE = 'notifications_retry';
  private readonly DLQ = 'notifications_dlq';

  constructor() {
    this.notificationService = new NotificationService();
    this.dbService = DatabaseService.getInstance();
    this.emailService = new EmailService();
  }

  async connect(): Promise<void> {
    try {
      logger.info('Connecting to RabbitMQ...');
      this.connection = await amqp.connect(config.rabbitmq.url);

      // Handle connection events
      this.connection.on('error', (err: Error) => {
        logger.error('RabbitMQ connection error:', err);
        if (!this.isShuttingDown) {
          this.reconnect();
        }
      });

      this.connection.on('close', () => {
        logger.warn('RabbitMQ connection closed');
        if (!this.isShuttingDown) {
          this.reconnect();
        }
      });

      this.channel = await this.connection.createChannel();

      // Set prefetch to limit concurrent message processing
      await this.channel.prefetch(10);

      // Setup exchanges
      await this.channel.assertExchange(config.rabbitmq.exchanges.order, 'topic', { durable: true });
      await this.channel.assertExchange(config.rabbitmq.exchanges.user, 'topic', { durable: true });

      // Setup notification queue with TTL and DLX
      // NOTE: If this fails with PRECONDITION_FAILED, delete the existing queue first:
      // docker exec notification-rabbitmq rabbitmqctl delete_queue notifications
      await this.channel.assertQueue(config.rabbitmq.queues.notifications, {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': '',
          'x-dead-letter-routing-key': this.DLQ,
        },
      });

      // Setup retry queue with TTL
      await this.channel.assertQueue(this.RETRY_QUEUE, {
        durable: true,
        arguments: {
          'x-message-ttl': 5000, // 5 seconds TTL
          'x-dead-letter-exchange': '',
          'x-dead-letter-routing-key': config.rabbitmq.queues.notifications,
        },
      });

      // Setup Dead Letter Queue
      await this.channel.assertQueue(this.DLQ, {
        durable: true,
        arguments: {
          'x-message-ttl': 86400000, // 24 hours TTL for DLQ messages
        },
      });

      // Bind queue to exchanges for different event patterns
      await this.channel.bindQueue(config.rabbitmq.queues.notifications, config.rabbitmq.exchanges.order, 'order.*');
      await this.channel.bindQueue(config.rabbitmq.queues.notifications, config.rabbitmq.exchanges.user, 'user.*');

      // Test database connection
      await this.dbService.testConnection();

      logger.info('✅ RabbitMQ connection established');
      logger.info(`📥 Listening to queues: ${config.rabbitmq.queues.notifications}`);
      logger.info(`🔄 Bound to exchanges: ${config.rabbitmq.exchanges.order}, ${config.rabbitmq.exchanges.user}`);
      logger.info(`🔁 Retry queue: ${this.RETRY_QUEUE}`);
      logger.info(`💀 Dead letter queue: ${this.DLQ}`);
    } catch (error) {
      logger.error('❌ Failed to connect to RabbitMQ or database:', error);
      throw error;
    }
  }

  private async reconnect(): Promise<void> {
    logger.info('🔄 Attempting to reconnect to RabbitMQ...');
    let retryCount = 0;
    const maxRetries = 10;

    while (retryCount < maxRetries && !this.isShuttingDown) {
      try {
        await new Promise((resolve) => setTimeout(resolve, Math.min(1000 * Math.pow(2, retryCount), 30000)));
        await this.connect();
        await this.startConsuming();
        logger.info('✅ RabbitMQ reconnection successful');
        return;
      } catch (error) {
        retryCount++;
        logger.error(`❌ Reconnection attempt ${retryCount} failed:`, error);
      }
    }

    logger.error('💀 Failed to reconnect to RabbitMQ after maximum retries');
    process.exit(1);
  }

  async startConsuming(): Promise<void> {
    if (!this.channel) {
      throw new Error('Channel not initialized. Call connect() first.');
    }

    logger.info('🚀 Starting message consumption...');

    // Consume main notification queue
    await this.channel.consume(
      config.rabbitmq.queues.notifications,
      async (message: any) => {
        if (message && !this.isShuttingDown) {
          await this.handleMessage(message, 'main');
        }
      },
      { noAck: false }
    );

    // Also consume dead letter queue for monitoring
    await this.channel.consume(
      this.DLQ,
      async (message: any) => {
        if (message && !this.isShuttingDown) {
          await this.handleDeadLetterMessage(message);
        }
      },
      { noAck: false }
    );

    // Start periodic queue metrics update
    this.startMetricsUpdate();

    logger.info(`🎯 Message consumers started - listening for events`);
  }

  private startMetricsUpdate(): void {
    // Update queue metrics every 30 seconds
    const updateInterval = setInterval(async () => {
      if (this.isShuttingDown) {
        clearInterval(updateInterval);
        return;
      }

      try {
        await this.getQueueStats();
        // Queue stats available for monitoring if needed
      } catch (error) {
        logger.warn('⚠️ Failed to update queue metrics:', error);
      }
    }, 30000); // 30 seconds
  }

  private async handleMessage(message: any, queueType: 'main' | 'retry'): Promise<void> {
    const startTime = Date.now();
    const messageId = message.properties.messageId || 'unknown';
    const correlationId = message.properties.correlationId || 'unknown';

    try {
      const eventData = JSON.parse(message.content.toString());
      const metadata: MessageMetadata = this.extractMessageMetadata(message);

      logger.info('📨 Received event:', {
        messageId,
        correlationId,
        eventType: eventData.eventType,
        retryCount: metadata.retryCount || 0,
        queueType,
      });

      // Process the notification event
      await this.processNotificationEvent(eventData);

      // Record successful processing metrics
      const duration = Date.now() - startTime;
      // this.monitoring.recordMessageProcessed(duration);

      // Acknowledge the message on success
      this.channel.ack(message);
      logger.info('✅ Event processed successfully:', {
        messageId,
        correlationId,
        duration: `${duration}ms`,
      });
    } catch (error) {
      const duration = Date.now() - startTime;

      // Record failure metrics
      // this.monitoring.recordMessageFailed();

      logger.error('❌ Error processing message:', {
        messageId,
        correlationId,
        error: error instanceof Error ? error.message : error,
        duration: `${duration}ms`,
      });

      await this.handleMessageFailure(message, error);
    }
  }

  private async handleMessageFailure(message: any, error: any): Promise<void> {
    const metadata: MessageMetadata = this.extractMessageMetadata(message);
    const retryCount = (metadata.retryCount || 0) + 1;
    const currentTime = Date.now();

    if (retryCount <= this.retryConfig.maxRetries) {
      // Calculate delay with exponential backoff
      const delay = Math.min(
        this.retryConfig.initialDelay * Math.pow(this.retryConfig.backoffMultiplier, retryCount - 1),
        this.retryConfig.maxDelay
      );

      // Record retry metrics
      // this.monitoring.recordMessageRetried();

      logger.info(`🔄 Retrying message (attempt ${retryCount}/${this.retryConfig.maxRetries}) in ${delay}ms`);

      // Add retry metadata
      const updatedMetadata: MessageMetadata = {
        retryCount,
        firstFailureTime: metadata.firstFailureTime || currentTime,
        lastFailureTime: currentTime,
        originalQueue: config.rabbitmq.queues.notifications,
      };

      // Publish to retry queue with updated metadata
      await this.channel.publish('', this.RETRY_QUEUE, message.content, {
        ...message.properties,
        headers: {
          ...message.properties.headers,
          ...updatedMetadata,
        },
      });

      // Reject message (will not requeue since we're handling retry manually)
      this.channel.nack(message, false, false);
    } else {
      // Record dead letter metrics
      // this.monitoring.recordMessageDeadLetter();

      logger.error(`💀 Message exceeded max retries (${this.retryConfig.maxRetries}), sending to DLQ`);

      // Add final metadata before sending to DLQ
      const finalMetadata: MessageMetadata = {
        retryCount,
        firstFailureTime: metadata.firstFailureTime || currentTime,
        lastFailureTime: currentTime,
        originalQueue: config.rabbitmq.queues.notifications,
      };

      // Send to DLQ with metadata
      await this.channel.publish('', this.DLQ, message.content, {
        ...message.properties,
        headers: {
          ...message.properties.headers,
          ...finalMetadata,
          finalError: error instanceof Error ? error.message : String(error),
        },
      });

      // Reject message
      this.channel.nack(message, false, false);
    }
  }

  private extractMessageMetadata(message: any): MessageMetadata {
    const headers = message.properties.headers || {};
    return {
      retryCount: headers.retryCount || 0,
      firstFailureTime: headers.firstFailureTime,
      lastFailureTime: headers.lastFailureTime,
      originalQueue: headers.originalQueue,
    };
  }

  private async handleDeadLetterMessage(message: any): Promise<void> {
    try {
      const eventData = JSON.parse(message.content.toString());
      const metadata = this.extractMessageMetadata(message);

      logger.error('💀 Processing dead letter message:', {
        eventType: eventData.eventType,
        userId: eventData.userId,
        retryCount: metadata.retryCount,
        firstFailureTime: new Date(metadata.firstFailureTime || 0).toISOString(),
        lastFailureTime: new Date(metadata.lastFailureTime || 0).toISOString(),
        finalError: message.properties.headers?.finalError,
      });

      // Here you could implement additional logic for DLQ messages:
      // - Send to monitoring/alerting system
      // - Store in database for manual review
      // - Send notification to administrators

      // For now, just acknowledge the message
      this.channel.ack(message);
    } catch (error) {
      logger.error('❌ Error processing dead letter message:', error);
      this.channel.nack(message, false, false);
    }
  }

  private async processNotificationEvent(eventData: any): Promise<void> {
    // Validate event structure
    if (!eventData.eventType || !eventData.userId) {
      logger.warn('⚠️ Invalid event structure, missing eventType or userId');
      return;
    }

    // Check if it's a supported event type
    if (!Object.values(EventTypes).includes(eventData.eventType)) {
      logger.warn(`⚠️ Unsupported event type: ${eventData.eventType}`);
      return;
    }

    logger.info('🔔 Processing notification for event:', {
      eventType: eventData.eventType,
      userId: eventData.userId,
      timestamp: new Date().toISOString(),
    });

    // Process the notification with template rendering and email delivery
    await this.sendNotification(eventData);
  }

  private async sendNotification(eventData: any): Promise<void> {
    let notificationId: string | undefined;

    try {
      // Save notification to database first (with template rendering)
      notificationId = await this.notificationService.createNotification(eventData, 'email');

      logger.info('📤 Processing notification:', {
        notificationId,
        to: eventData.userId,
        eventType: eventData.eventType,
      });

      // Get the saved notification record to access rendered content
      const notification = await this.notificationService.getNotificationById(notificationId);

      if (!notification) {
        throw new Error('Failed to retrieve saved notification');
      }

      // Send actual email notification
      let emailSent = false;
      if (eventData.userEmail && this.emailService.isEnabled()) {
        emailSent = await this.emailService.sendNotificationEmail(
          eventData.userEmail,
          notification.subject || 'Notification',
          notification.message,
          eventData.eventType,
          eventData.data
        );

        if (emailSent) {
          await this.notificationService.updateNotificationStatus(notificationId, 'sent');
          logger.info('✅ Email notification sent successfully:', {
            notificationId,
            email: eventData.userEmail,
          });
        } else {
          await this.notificationService.updateNotificationStatus(notificationId, 'failed', 'Email sending failed');
          logger.error('❌ Failed to send email notification:', { notificationId });
        }
      } else {
        await this.notificationService.updateNotificationStatus(
          notificationId,
          'failed',
          'No email address or email service disabled'
        );
        logger.warn('⚠️ Email notification skipped:', {
          notificationId,
          hasEmail: !!eventData.userEmail,
          emailEnabled: this.emailService.isEnabled(),
        });
      }
    } catch (error) {
      logger.error('❌ Failed to send notification:', error);

      // Update notification status to failed if we have the ID
      if (notificationId) {
        try {
          await this.notificationService.updateNotificationStatus(
            notificationId,
            'failed',
            error instanceof Error ? error.message : 'Unknown error'
          );
        } catch (updateError) {
          logger.error('❌ Failed to update notification status:', updateError);
        }
      }

      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.isShuttingDown = true;

    try {
      logger.info('🛑 Stopping message consumer...');

      if (this.channel) {
        // Cancel all consumers gracefully
        await this.channel.cancel('');
        await this.channel.close();
        logger.info('📦 Channel closed');
      }

      if (this.connection) {
        await this.connection.close();
        logger.info('🔌 RabbitMQ connection closed');
      }
    } catch (error) {
      logger.error('❌ Error closing RabbitMQ connection:', error);
    }
  }

  // Method to get queue statistics (useful for monitoring)
  async getQueueStats(): Promise<any> {
    if (!this.channel) {
      throw new Error('Channel not initialized');
    }

    try {
      const mainQueue = await this.channel.checkQueue(config.rabbitmq.queues.notifications);
      const retryQueue = await this.channel.checkQueue(this.RETRY_QUEUE);
      const dlq = await this.channel.checkQueue(this.DLQ);

      return {
        mainQueue: {
          name: config.rabbitmq.queues.notifications,
          messageCount: mainQueue.messageCount,
          consumerCount: mainQueue.consumerCount,
        },
        retryQueue: {
          name: this.RETRY_QUEUE,
          messageCount: retryQueue.messageCount,
          consumerCount: retryQueue.consumerCount,
        },
        deadLetterQueue: {
          name: this.DLQ,
          messageCount: dlq.messageCount,
          consumerCount: dlq.consumerCount,
        },
      };
    } catch (error) {
      logger.error('❌ Error getting queue stats:', error);
      throw error;
    }
  }

  // Method to manually retry DLQ messages (for admin use)
  async retryDeadLetterMessages(limit: number = 10): Promise<number> {
    if (!this.channel) {
      throw new Error('Channel not initialized');
    }

    let retriedCount = 0;

    try {
      for (let i = 0; i < limit; i++) {
        const message = await this.channel.get(this.DLQ);

        if (!message) {
          break; // No more messages
        }

        // Reset retry metadata and send back to main queue
        const originalContent = message.content;
        const originalProperties = { ...message.properties };

        // Clear retry metadata
        delete originalProperties.headers?.retryCount;
        delete originalProperties.headers?.firstFailureTime;
        delete originalProperties.headers?.lastFailureTime;
        delete originalProperties.headers?.finalError;

        await this.channel.publish('', config.rabbitmq.queues.notifications, originalContent, originalProperties);

        this.channel.ack(message);
        retriedCount++;

        logger.info(`🔄 Retried dead letter message ${i + 1}`);
      }

      logger.info(`✅ Successfully retried ${retriedCount} messages from DLQ`);
      return retriedCount;
    } catch (error) {
      logger.error('❌ Error retrying dead letter messages:', error);
      throw error;
    }
  }
}

export default MessageConsumer;
