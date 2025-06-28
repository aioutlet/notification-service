import { v4 as uuidv4 } from 'uuid';
import DatabaseService from './database.service';
import logger from '../utils/logger';
import { NotificationEvent } from '../events/event-types';

export interface NotificationRecord {
  id?: number;
  notification_id: string;
  event_type: string;
  user_id: string;
  recipient_email?: string;
  recipient_phone?: string;
  message: string;
  channel: 'email' | 'sms' | 'push' | 'webhook';
  status: 'pending' | 'sent' | 'failed' | 'retry';
  attempts: number;
  sent_at?: Date;
  failed_at?: Date;
  error_message?: string;
  event_data?: any;
  created_at?: Date;
  updated_at?: Date;
}

class NotificationService {
  private db: DatabaseService;

  constructor() {
    this.db = DatabaseService.getInstance();
  }

  async createNotification(eventData: NotificationEvent, message: string): Promise<string> {
    const notificationId = uuidv4();

    try {
      const notification: Omit<NotificationRecord, 'id' | 'created_at' | 'updated_at'> = {
        notification_id: notificationId,
        event_type: eventData.eventType,
        user_id: eventData.userId,
        recipient_email: eventData.userEmail,
        recipient_phone: eventData.userPhone,
        message,
        channel: 'email', // Default channel for now
        status: 'pending',
        attempts: 0,
        event_data: JSON.stringify(eventData.data || {}),
      };

      const query = `
        INSERT INTO notifications (
          notification_id, event_type, user_id, recipient_email, recipient_phone,
          message, channel, status, attempts, event_data
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const values = [
        notification.notification_id,
        notification.event_type,
        notification.user_id,
        notification.recipient_email,
        notification.recipient_phone,
        notification.message,
        notification.channel,
        notification.status,
        notification.attempts,
        notification.event_data,
      ];

      await this.db.query(query, values);

      logger.info('💾 Notification saved to database:', {
        notificationId,
        eventType: eventData.eventType,
        userId: eventData.userId,
      });

      return notificationId;
    } catch (error) {
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

      const notification = results[0];
      return {
        ...notification,
        event_data: this.parseEventData(notification.event_data),
      };
    } catch (error) {
      logger.error('❌ Failed to get notification by ID:', error);
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
}

export default NotificationService;
