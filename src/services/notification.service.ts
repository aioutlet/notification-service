import { v4 as uuidv4 } from 'uuid';
import DatabaseService from './database.service';
import TemplateService, { TemplateVariables } from './template.service';
import logger from '../utils/logger';
import { NotificationEvent } from '../events/event-types';

export interface NotificationRecord {
  id?: number;
  notification_id: string;
  event_type: string;
  user_id: string;
  recipient_email?: string;
  recipient_phone?: string;
  subject?: string;
  message: string;
  channel: 'email' | 'sms' | 'push' | 'webhook';
  status: 'pending' | 'sent' | 'failed' | 'retry';
  attempts: number;
  sent_at?: Date;
  failed_at?: Date;
  error_message?: string;
  event_data?: any;
  template_id?: number;
  created_at?: Date;
  updated_at?: Date;
}

class NotificationService {
  private db: DatabaseService;
  private templateService: TemplateService;

  constructor() {
    this.db = DatabaseService.getInstance();
    this.templateService = new TemplateService();
  }

  async createNotification(
    eventData: NotificationEvent,
    channel: 'email' | 'sms' | 'push' | 'webhook' = 'email'
  ): Promise<string> {
    const startTime = Date.now();
    const notificationId = uuidv4();

    try {
      // Get the template for this event type and channel
      const template = await this.templateService.getTemplate(eventData.eventType, channel);

      if (!template) {
        logger.warn(`⚠️ No template found for event: ${eventData.eventType}, channel: ${channel}`);
        // Create a basic notification without template
        const result = await this.createBasicNotification(eventData, channel, notificationId);
        const duration = Date.now() - startTime;
        return result;
      }

      // Prepare template variables from event data
      const templateVariables = this.prepareTemplateVariables(eventData);

      // Render the template
      const rendered = this.templateService.renderTemplate(template, templateVariables);

      const notification: Omit<NotificationRecord, 'id' | 'created_at' | 'updated_at'> = {
        notification_id: notificationId,
        event_type: eventData.eventType,
        user_id: eventData.userId,
        recipient_email: eventData.userEmail,
        recipient_phone: eventData.userPhone,
        subject: rendered.subject,
        message: rendered.message,
        channel,
        status: 'pending',
        attempts: 0,
        event_data: JSON.stringify(eventData.data || {}),
        template_id: template.id,
      };

      const query = `
        INSERT INTO notifications (
          notification_id, event_type, user_id, recipient_email, recipient_phone,
          subject, message, channel, status, attempts, event_data, template_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const values = [
        notification.notification_id,
        notification.event_type,
        notification.user_id,
        notification.recipient_email ?? null,
        notification.recipient_phone ?? null,
        notification.subject ?? null,
        notification.message,
        notification.channel,
        notification.status,
        notification.attempts,
        notification.event_data,
        notification.template_id ?? null,
      ];

      await this.db.query(query, values);
      const duration = Date.now() - startTime;

      logger.info('💾 Notification saved to database with template:', {
        notificationId,
        eventType: eventData.eventType,
        userId: eventData.userId,
        templateId: template.id,
        channel,
        duration: `${duration}ms`,
      });

      return notificationId;
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('❌ Failed to save notification to database:', error);
      throw error;
    }
  }

  async updateNotificationStatus(
    notificationId: string,
    status: 'sent' | 'failed' | 'retry',
    errorMessage?: string
  ): Promise<void> {
    try {
      let query = `
        UPDATE notifications 
        SET status = ?, attempts = attempts + 1, updated_at = CURRENT_TIMESTAMP
      `;
      const values: any[] = [status];

      if (status === 'sent') {
        query += ', sent_at = CURRENT_TIMESTAMP';
      } else if (status === 'failed') {
        query += ', failed_at = CURRENT_TIMESTAMP';
        if (errorMessage) {
          query += ', error_message = ?';
          values.push(errorMessage);
        }
      }

      query += ' WHERE notification_id = ?';
      values.push(notificationId);

      await this.db.query(query, values);

      logger.info('📝 Notification status updated:', {
        notificationId,
        status,
        errorMessage,
      });
    } catch (error) {
      logger.error('❌ Failed to update notification status:', error);
      throw error;
    }
  }
  async getNotificationsByUser(userId: string, limit: number = 50, offset: number = 0): Promise<NotificationRecord[]> {
    try {
      // Ensure limit and offset are valid integers
      const safeLimit = Math.max(1, Math.min(limit, 1000)); // Between 1 and 1000
      const safeOffset = Math.max(0, offset);

      const query = `
        SELECT * FROM notifications 
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        LIMIT ${safeLimit} OFFSET ${safeOffset}
      `;

      const results = await this.db.query(query, [userId]);

      // Handle event_data properly - it might be a string or already an object
      return results.map((row: any) => ({
        ...row,
        event_data: this.parseEventData(row.event_data),
      }));
    } catch (error) {
      logger.error('❌ Failed to get notifications for user:', error);
      throw error;
    }
  }
  async getNotificationById(notificationId: string): Promise<NotificationRecord | null> {
    try {
      const query = 'SELECT * FROM notifications WHERE notification_id = ?';
      const results = await this.db.query(query, [notificationId]);

      if (results.length === 0) {
        return null;
      }

      return results[0] as NotificationRecord;
    } catch (error) {
      logger.error('❌ Failed to get notification by ID:', { notificationId, error });
      throw error;
    }
  }

  async getNotificationStats(userId?: string): Promise<any> {
    try {
      let query = `
        SELECT 
          status,
          COUNT(*) as count
        FROM notifications
      `;
      const values: any[] = [];

      if (userId) {
        query += ' WHERE user_id = ?';
        values.push(userId);
      }

      query += ' GROUP BY status';

      const results = await this.db.query(query, values);

      return results.reduce((stats: any, row: any) => {
        stats[row.status] = parseInt(row.count);
        return stats;
      }, {});
    } catch (error) {
      logger.error('❌ Failed to get notification stats:', error);
      throw error;
    }
  }

  private parseEventData(eventData: any): any {
    if (!eventData) {
      return null;
    }

    // If it's already an object, return it as-is
    if (typeof eventData === 'object') {
      return eventData;
    }

    // If it's a string, try to parse it as JSON
    if (typeof eventData === 'string') {
      try {
        return JSON.parse(eventData);
      } catch (error) {
        logger.warn('⚠️ Failed to parse event_data as JSON, returning as string:', { eventData });
        return eventData;
      }
    }

    // For any other type, return as-is
    return eventData;
  }

  private async createBasicNotification(
    eventData: NotificationEvent,
    channel: 'email' | 'sms' | 'push' | 'webhook',
    notificationId: string
  ): Promise<string> {
    // Fallback to basic notification without template
    const basicMessage = this.generateBasicMessage(eventData);

    const notification: Omit<NotificationRecord, 'id' | 'created_at' | 'updated_at'> = {
      notification_id: notificationId,
      event_type: eventData.eventType,
      user_id: eventData.userId,
      recipient_email: eventData.userEmail,
      recipient_phone: eventData.userPhone,
      subject: `Notification: ${eventData.eventType}`,
      message: basicMessage,
      channel,
      status: 'pending',
      attempts: 0,
      event_data: JSON.stringify(eventData.data || {}),
    };

    const query = `
      INSERT INTO notifications (
        notification_id, event_type, user_id, recipient_email, recipient_phone,
        subject, message, channel, status, attempts, event_data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      notification.notification_id,
      notification.event_type,
      notification.user_id,
      notification.recipient_email ?? null,
      notification.recipient_phone ?? null,
      notification.subject ?? null,
      notification.message,
      notification.channel,
      notification.status,
      notification.attempts,
      notification.event_data,
    ];

    await this.db.query(query, values);

    logger.info('💾 Basic notification saved to database:', {
      notificationId,
      eventType: eventData.eventType,
      userId: eventData.userId,
      channel,
    });

    return notificationId;
  }

  private prepareTemplateVariables(eventData: NotificationEvent): TemplateVariables {
    const variables: TemplateVariables = {
      userId: eventData.userId,
      userEmail: eventData.userEmail,
      userPhone: eventData.userPhone,
      eventType: eventData.eventType,
      timestamp: new Date().toISOString(),
      ...(eventData.data || {}), // Spread event-specific data
    };

    // Add event-specific variables based on event type
    if (eventData.eventType.startsWith('order.')) {
      const orderData = eventData.data as any;
      if (orderData) {
        variables.orderId = orderData.orderId;
        variables.orderNumber = orderData.orderNumber;
        variables.orderAmount = orderData.amount;
        variables.orderItems = orderData.items;
      }
    } else if (eventData.eventType.startsWith('payment.')) {
      const paymentData = eventData.data as any;
      if (paymentData) {
        variables.paymentId = paymentData.paymentId;
        variables.amount = paymentData.amount;
        variables.orderId = paymentData.orderId;
        variables.reason = paymentData.reason;
      }
    } else if (eventData.eventType.startsWith('profile.')) {
      const profileData = eventData.data as any;
      if (profileData) {
        variables.previousEmail = profileData.previousEmail;
        variables.updatedFields = profileData.updatedFields;
      }
    }

    return variables;
  }

  private generateBasicMessage(eventData: NotificationEvent): string {
    const data = eventData.data as any;

    if (eventData.eventType.startsWith('order.')) {
      const orderId = data?.orderId || 'N/A';
      if (eventData.eventType.includes('placed')) {
        return `Your order ${orderId} has been placed successfully.`;
      } else if (eventData.eventType.includes('cancelled')) {
        return `Your order ${orderId} has been cancelled.`;
      } else if (eventData.eventType.includes('delivered')) {
        return `Your order ${orderId} has been delivered.`;
      }
      return `Order ${orderId} update.`;
    } else if (eventData.eventType.startsWith('payment.')) {
      const amount = data?.amount || 'N/A';
      if (eventData.eventType.includes('received')) {
        return `Payment of ${amount} has been received successfully.`;
      } else if (eventData.eventType.includes('failed')) {
        const reason = data?.reason ? ` Reason: ${data.reason}` : '';
        return `Payment of ${amount} has failed.${reason}`;
      }
      return `Payment update: ${amount}`;
    } else if (eventData.eventType.startsWith('profile.')) {
      if (eventData.eventType.includes('password_changed')) {
        return `Your password has been changed successfully.`;
      } else if (eventData.eventType.includes('notification_preferences')) {
        return `Your notification preferences have been updated.`;
      } else if (eventData.eventType.includes('bank_details')) {
        return `Your bank details have been updated.`;
      }
      return `Your profile has been updated.`;
    }

    return `Notification: ${eventData.eventType}`;
  }

  async getAllNotifications(
    options: {
      limit?: number;
      offset?: number;
      status?: string;
      eventType?: string;
    } = {}
  ): Promise<NotificationRecord[]> {
    try {
      const { limit = 50, offset = 0, status, eventType } = options;

      // Ensure limit and offset are valid integers
      const safeLimit = Math.max(1, Math.min(limit, 1000)); // Between 1 and 1000
      const safeOffset = Math.max(0, offset);

      let query = 'SELECT * FROM notifications';
      const conditions: string[] = [];
      const values: any[] = [];

      // Add filters if provided
      if (status) {
        conditions.push('status = ?');
        values.push(status);
      }

      if (eventType) {
        conditions.push('event_type = ?');
        values.push(eventType);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += ` ORDER BY created_at DESC LIMIT ${safeLimit} OFFSET ${safeOffset}`;

      const results = await this.db.query(query, values);

      // Handle event_data properly - it might be a string or already an object
      return results.map((row: any) => ({
        ...row,
        event_data: this.parseEventData(row.event_data),
      }));
    } catch (error) {
      logger.error('❌ Failed to get all notifications:', error);
      throw error;
    }
  }
}

export default NotificationService;
