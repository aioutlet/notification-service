import amqp from 'amqplib';
import config from '../config/index';
import logger from '../utils/logger';
import { NotificationEvent, EventTypes } from '../events/event-types';
import NotificationService from './notification.service';
import DatabaseService from './database.service';
import EmailService from './email.service';

class MessageConsumer {
  private connection: any = null;
  private channel: any = null;
  private notificationService: NotificationService;
  private dbService: DatabaseService;
  private emailService: EmailService;

  constructor() {
    this.notificationService = new NotificationService();
    this.dbService = DatabaseService.getInstance();
    this.emailService = new EmailService();
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
