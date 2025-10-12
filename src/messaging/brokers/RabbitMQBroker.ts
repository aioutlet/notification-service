/**
 * RabbitMQ Broker Implementation
 * Implements the IMessageBroker interface for RabbitMQ
 */

import { Channel, Connection, connect } from 'amqplib';
import config from '../../config/index.js';
import logger from '../../observability/logging/index.js';
import { IMessageBroker } from '../IMessageBroker.js';
import NotificationService from '../../services/notification.service.js';
import DatabaseService from '../../services/database.service.js';
import EmailService from '../../services/email.service.js';

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

export class RabbitMQBroker implements IMessageBroker {
  private connection: Connection | null = null;
  private channel: Channel | null = null;
  private notificationService: NotificationService;
  private dbService: DatabaseService;
  private emailService: EmailService;
  private isShuttingDown = false;
  private eventHandlers: Map<string, (eventData: any, correlationId: string) => Promise<void>> = new Map();

  // Configuration
  private readonly rabbitmqUrl: string;
  private readonly queueName: string;

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

  constructor(rabbitmqUrl: string, queueName: string) {
    this.rabbitmqUrl = rabbitmqUrl;
    this.queueName = queueName;
    this.notificationService = new NotificationService();
    this.dbService = DatabaseService.getInstance();
    this.emailService = new EmailService();
  }

  async connect(): Promise<void> {
    try {
      logger.info('Connecting to RabbitMQ...', { url: this.rabbitmqUrl.replace(/\/\/[^@]*@/, '//***:***@') });
      this.connection = await connect(this.rabbitmqUrl);

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

      // Setup main exchange (aioutlet.events)
      await this.channel.assertExchange(config.rabbitmq.exchange, 'topic', { durable: true });

      // Setup notification queue - use the queue created by setup script
      await this.channel.checkQueue(this.queueName);

      // Setup retry queue with TTL
      await this.channel.assertQueue(this.RETRY_QUEUE, {
        durable: true,
        arguments: {
          'x-message-ttl': 5000, // 5 seconds TTL
          'x-dead-letter-exchange': '',
          'x-dead-letter-routing-key': this.queueName,
        },
      });

      // Setup Dead Letter Queue
      await this.channel.assertQueue(this.DLQ, {
        durable: true,
        arguments: {
          'x-message-ttl': 86400000, // 24 hours TTL for DLQ messages
        },
      });

      // Test database connection
      await this.dbService.testConnection();

      logger.info('✅ RabbitMQ connection established');
      logger.info(`📥 Listening to queue: ${this.queueName}`);
      logger.info(`📡 Connected to exchange: ${config.rabbitmq.exchange}`);
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

  registerEventHandler(eventType: string, handler: (eventData: any, correlationId: string) => Promise<void>): void {
    this.eventHandlers.set(eventType, handler);
    logger.debug(`Registered event handler for: ${eventType}`);
  }

  async startConsuming(): Promise<void> {
    if (!this.channel) {
      throw new Error('Channel not initialized. Call connect() first.');
    }

    logger.info('🚀 Starting message consumption...');

    // Consume main notification queue
    await this.channel.consume(
      this.queueName,
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
    const updateInterval = setInterval(async () => {
      if (this.isShuttingDown) {
        clearInterval(updateInterval);
        return;
      }

      try {
        await this.getStats();
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
      let eventData = JSON.parse(message.content.toString());
      const metadata: MessageMetadata = this.extractMessageMetadata(message);

      // Handle message broker format: { topic, data } -> { eventType, ...data }
      if (eventData.topic && eventData.data) {
        eventData = {
          eventType: eventData.topic,
          ...eventData.data,
        };
      }

      // Ensure userId is set for database insertion (required field)
      if (!eventData.userId && (eventData.email || eventData.username)) {
        eventData.userId = eventData.email || eventData.username;
      }

      logger.info('📨 Received event:', {
        messageId,
        correlationId,
        eventType: eventData.eventType,
        retryCount: metadata.retryCount || 0,
        queueType,
      });

      // Check if there's a registered handler for this event type
      const handler = this.eventHandlers.get(eventData.eventType);
      if (handler) {
        await handler(eventData, correlationId);
      } else {
        // Default processing
        await this.processNotificationEvent(eventData);
      }

      const duration = Date.now() - startTime;
      this.channel!.ack(message);
      logger.info('✅ Event processed successfully:', {
        messageId,
        correlationId,
        duration: `${duration}ms`,
      });
    } catch (error) {
      const duration = Date.now() - startTime;
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
      const delay = Math.min(
        this.retryConfig.initialDelay * Math.pow(this.retryConfig.backoffMultiplier, retryCount - 1),
        this.retryConfig.maxDelay
      );

      logger.info(`🔄 Retrying message (attempt ${retryCount}/${this.retryConfig.maxRetries}) in ${delay}ms`);

      const updatedMetadata: MessageMetadata = {
        retryCount,
        firstFailureTime: metadata.firstFailureTime || currentTime,
        lastFailureTime: currentTime,
        originalQueue: this.queueName,
      };

      await this.channel!.publish('', this.RETRY_QUEUE, message.content, {
        ...message.properties,
        headers: {
          ...message.properties.headers,
          ...updatedMetadata,
        },
      });

      this.channel!.nack(message, false, false);
    } else {
      logger.error(`💀 Message exceeded max retries (${this.retryConfig.maxRetries}), sending to DLQ`);

      const finalMetadata: MessageMetadata = {
        retryCount,
        firstFailureTime: metadata.firstFailureTime || currentTime,
        lastFailureTime: currentTime,
        originalQueue: this.queueName,
      };

      await this.channel!.publish('', this.DLQ, message.content, {
        ...message.properties,
        headers: {
          ...message.properties.headers,
          ...finalMetadata,
          finalError: error instanceof Error ? error.message : String(error),
        },
      });

      this.channel!.nack(message, false, false);
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

      this.channel!.ack(message);
    } catch (error) {
      logger.error('❌ Error processing dead letter message:', error);
      this.channel!.nack(message, false, false);
    }
  }

  private async processNotificationEvent(eventData: any): Promise<void> {
    if (!eventData.eventType) {
      logger.warn('⚠️ Invalid event structure, missing eventType');
      return;
    }

    const identifier = eventData.userId || eventData.email || eventData.username || 'unknown';

    logger.info('🔔 Processing notification for event:', {
      eventType: eventData.eventType,
      identifier,
      email: eventData.email,
      timestamp: new Date().toISOString(),
    });

    await this.sendNotification(eventData);
  }

  private async sendNotification(eventData: any): Promise<void> {
    let notificationId: string | undefined;

    try {
      notificationId = await this.notificationService.createNotification(eventData, 'email');

      logger.info('📤 Processing notification:', {
        notificationId,
        to: eventData.userId,
        eventType: eventData.eventType,
      });

      const notification = await this.notificationService.getNotificationById(notificationId);

      if (!notification) {
        throw new Error('Failed to retrieve saved notification');
      }

      let emailSent = false;
      const recipientEmail = eventData.userEmail || eventData.email;

      if (recipientEmail && this.emailService.isEnabled()) {
        emailSent = await this.emailService.sendNotificationEmail(
          recipientEmail,
          notification.subject || 'Notification',
          notification.message,
          eventData.eventType,
          eventData.data
        );

        if (emailSent) {
          await this.notificationService.updateNotificationStatus(notificationId, 'sent');
          logger.info('✅ Email notification sent successfully:', {
            notificationId,
            email: recipientEmail,
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
          hasEmail: !!recipientEmail,
          emailEnabled: this.emailService.isEnabled(),
        });
      }
    } catch (error) {
      logger.error('❌ Failed to send notification:', error);

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

  async close(): Promise<void> {
    this.isShuttingDown = true;

    try {
      logger.info('🛑 Stopping RabbitMQ broker...');

      if (this.channel) {
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

  isHealthy(): boolean {
    return this.connection !== null && this.channel !== null && !this.isShuttingDown;
  }

  async getStats(): Promise<any> {
    if (!this.channel) {
      throw new Error('Channel not initialized');
    }

    try {
      const mainQueue = await this.channel.checkQueue(this.queueName);
      const retryQueue = await this.channel.checkQueue(this.RETRY_QUEUE);
      const dlq = await this.channel.checkQueue(this.DLQ);

      return {
        mainQueue: {
          name: this.queueName,
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
}
