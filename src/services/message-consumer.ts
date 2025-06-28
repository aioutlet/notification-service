import amqp from 'amqplib';
import config from '../config/index';
import logger from '../utils/logger';
import { NotificationEvent, EventTypes } from '../events/event-types';
import NotificationService from './notification.service';
import DatabaseService from './database.service';

class MessageConsumer {
  private connection: any = null;
  private channel: any = null;
  private notificationService: NotificationService;
  private dbService: DatabaseService;

  constructor() {
    this.notificationService = new NotificationService();
    this.dbService = DatabaseService.getInstance();
  }

  async connect(): Promise<void> {
    try {
      logger.info('Connecting to RabbitMQ...');
      this.connection = await amqp.connect(config.rabbitmq.url);
      this.channel = await this.connection.createChannel();

      // Setup exchanges
      await this.channel.assertExchange(config.rabbitmq.exchanges.order, 'topic', { durable: true });
      await this.channel.assertExchange(config.rabbitmq.exchanges.user, 'topic', { durable: true });

      // Setup notification queue
      await this.channel.assertQueue(config.rabbitmq.queues.notifications, { durable: true });

      // Bind queue to exchanges for different event patterns
      await this.channel.bindQueue(config.rabbitmq.queues.notifications, config.rabbitmq.exchanges.order, 'order.*');
      await this.channel.bindQueue(config.rabbitmq.queues.notifications, config.rabbitmq.exchanges.user, 'user.*');

      // Test database connection
      await this.dbService.testConnection();

      logger.info('✅ RabbitMQ connection established');
      logger.info(`📥 Listening to queues: ${config.rabbitmq.queues.notifications}`);
      logger.info(`🔄 Bound to exchanges: ${config.rabbitmq.exchanges.order}, ${config.rabbitmq.exchanges.user}`);
    } catch (error) {
      logger.error('❌ Failed to connect to RabbitMQ or database:', error);
      throw error;
    }
  }

  async startConsuming(): Promise<void> {
    if (!this.channel) {
      throw new Error('Channel not initialized. Call connect() first.');
    }

    logger.info('🚀 Starting message consumption...');

    await this.channel.consume(
      config.rabbitmq.queues.notifications,
      async (message: any) => {
        if (message) {
          try {
            const eventData = JSON.parse(message.content.toString());
            logger.info('📨 Received event:', eventData);

            // Process the notification event
            await this.processNotificationEvent(eventData);

            // Acknowledge the message
            this.channel.ack(message);
            logger.info('✅ Event processed successfully');
          } catch (error) {
            logger.error('❌ Error processing message:', error);
            // Reject and requeue the message
            this.channel.nack(message, false, true);
          }
        }
      },
      { noAck: false }
    );
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

    // TODO: Here we'll add the actual notification sending logic
    // For now, just log the notification processing
    await this.sendNotification(eventData);
  }

  private async sendNotification(eventData: any): Promise<void> {
    let notificationId: string | undefined;

    try {
      // Generate notification message
      const notificationMessage = this.generateNotificationMessage(eventData);

      // Save notification to database first
      notificationId = await this.notificationService.createNotification(eventData, notificationMessage);

      logger.info('📤 Processing notification:', {
        notificationId,
        to: eventData.userId,
        message: notificationMessage,
        eventType: eventData.eventType,
      });

      // TODO: Implement actual email/SMS sending here
      // For now, we'll just mark it as sent
      // await emailService.send(...)
      // await smsService.send(...)

      // Simulate successful delivery for now
      await this.notificationService.updateNotificationStatus(notificationId, 'sent');

      logger.info('✅ Notification sent successfully:', { notificationId });
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

  private generateNotificationMessage(eventData: any): string {
    switch (eventData.eventType) {
      case EventTypes.ORDER_PLACED:
        return `Your order #${eventData.data?.orderNumber || 'N/A'} has been placed successfully!`;
      case EventTypes.ORDER_DELIVERED:
        return `Your order #${eventData.data?.orderNumber || 'N/A'} has been delivered!`;
      case EventTypes.ORDER_CANCELLED:
        return `Your order #${eventData.data?.orderNumber || 'N/A'} has been cancelled.`;
      case EventTypes.PAYMENT_RECEIVED:
        return `Payment of $${eventData.data?.amount || 'N/A'} has been received for your order.`;
      case EventTypes.PAYMENT_FAILED:
        return `Payment failed for your order. Please try again.`;
      case EventTypes.PROFILE_PASSWORD_CHANGED:
        return `Your password has been changed successfully.`;
      case EventTypes.PROFILE_NOTIFICATION_PREFERENCES_UPDATED:
        return `Your notification preferences have been updated.`;
      case EventTypes.PROFILE_BANK_DETAILS_UPDATED:
        return `Your bank details have been updated successfully.`;
      default:
        return `You have a new notification: ${eventData.eventType}`;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.channel) {
        await this.channel.close();
      }
      if (this.connection) {
        await this.connection.close();
      }
      logger.info('🔌 RabbitMQ connection closed');
    } catch (error) {
      logger.error('❌ Error closing RabbitMQ connection:', error);
    }
  }
}

export default MessageConsumer;
