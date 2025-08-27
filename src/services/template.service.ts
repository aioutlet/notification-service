import DatabaseService from './database.service.js';
import logger from '../utils/logger.js';

export interface NotificationTemplate {
  id?: number;
  event_type: string;
  channel: 'email' | 'sms' | 'push' | 'webhook';
  template_name: string;
  subject?: string;
  message_template: string;
  is_active: boolean;
  created_at?: Date;
  updated_at?: Date;
}

export interface TemplateVariables {
  [key: string]: any;
}

export interface RenderedTemplate {
  subject?: string;
  message: string;
  html?: string;
}

class TemplateService {
  private db: DatabaseService;

  constructor() {
    this.db = DatabaseService.getInstance();
  }

  async getTemplate(eventType: string, channel: string): Promise<NotificationTemplate | null> {
    try {
      const query = `
        SELECT * FROM notification_templates 
        WHERE event_type = ? AND channel = ? AND is_active = TRUE 
        ORDER BY created_at DESC 
        LIMIT 1
      `;

      const results = await this.db.query(query, [eventType, channel]);

      if (results.length === 0) {
        logger.debug(`📄 No template found for event: ${eventType}, channel: ${channel}`);
        return null;
      }

      return results[0] as NotificationTemplate;
    } catch (error) {
      logger.error('❌ Failed to get template:', { eventType, channel, error });
      throw error;
    }
  }

  async getAllTemplates(activeOnly: boolean = true): Promise<NotificationTemplate[]> {
    try {
      let query = 'SELECT * FROM notification_templates';
      const params: any[] = [];

      if (activeOnly) {
        query += ' WHERE is_active = TRUE';
      }

      query += ' ORDER BY event_type, channel';

      const results = await this.db.query(query, params);
      return results as NotificationTemplate[];
    } catch (error) {
      logger.error('❌ Failed to get all templates:', error);
      throw error;
    }
  }

  async createTemplate(template: Omit<NotificationTemplate, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
    try {
      const query = `
        INSERT INTO notification_templates (
          event_type, channel, template_name, subject, message_template, is_active
        ) VALUES (?, ?, ?, ?, ?, ?)
      `;

      const values = [
        template.event_type,
        template.channel,
        template.template_name,
        template.subject,
        template.message_template,
        template.is_active,
      ];

      const result = await this.db.execute(query, values);

      logger.info('📄 Template created:', {
        templateId: result.insertId,
        eventType: template.event_type,
        channel: template.channel,
      });

      return result.insertId || 0;
    } catch (error) {
      logger.error('❌ Failed to create template:', error);
      throw error;
    }
  }

  async updateTemplate(id: number, updates: Partial<NotificationTemplate>): Promise<boolean> {
    try {
      const setParts: string[] = [];
      const values: any[] = [];

      // Build dynamic UPDATE query
      if (updates.event_type !== undefined) {
        setParts.push('event_type = ?');
        values.push(updates.event_type);
      }
      if (updates.channel !== undefined) {
        setParts.push('channel = ?');
        values.push(updates.channel);
      }
      if (updates.template_name !== undefined) {
        setParts.push('template_name = ?');
        values.push(updates.template_name);
      }
      if (updates.subject !== undefined) {
        setParts.push('subject = ?');
        values.push(updates.subject);
      }
      if (updates.message_template !== undefined) {
        setParts.push('message_template = ?');
        values.push(updates.message_template);
      }
      if (updates.is_active !== undefined) {
        setParts.push('is_active = ?');
        values.push(updates.is_active);
      }

      if (setParts.length === 0) {
        logger.warn('⚠️ No valid fields to update in template');
        return false;
      }

      setParts.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);

      const query = `UPDATE notification_templates SET ${setParts.join(', ')} WHERE id = ?`;

      const result = await this.db.execute(query, values);

      logger.info('📄 Template updated:', { templateId: id, affectedRows: result.affectedRows });

      return (result.affectedRows || 0) > 0;
    } catch (error) {
      logger.error('❌ Failed to update template:', { templateId: id, error });
      throw error;
    }
  }

  async deleteTemplate(id: number): Promise<boolean> {
    try {
      const query = 'DELETE FROM notification_templates WHERE id = ?';
      const result = await this.db.execute(query, [id]);

      logger.info('📄 Template deleted:', { templateId: id, affectedRows: result.affectedRows });

      return (result.affectedRows || 0) > 0;
    } catch (error) {
      logger.error('❌ Failed to delete template:', { templateId: id, error });
      throw error;
    }
  }

  renderTemplate(template: NotificationTemplate, variables: TemplateVariables): RenderedTemplate {
    try {
      // Replace placeholders in both subject and message
      const renderedSubject = template.subject ? this.replacePlaceholders(template.subject, variables) : undefined;
      const renderedMessage = this.replacePlaceholders(template.message_template, variables);

      // Generate HTML version for email templates
      let renderedHtml: string | undefined;
      if (template.channel === 'email') {
        renderedHtml = this.generateEmailHTML(renderedMessage, template.event_type, variables);
      }

      logger.debug('📄 Template rendered:', {
        eventType: template.event_type,
        channel: template.channel,
        variableCount: Object.keys(variables).length,
      });

      return {
        subject: renderedSubject,
        message: renderedMessage,
        html: renderedHtml,
      };
    } catch (error) {
      logger.error('❌ Failed to render template:', { template: template.template_name, error });
      throw error;
    }
  }

  private replacePlaceholders(text: string, variables: TemplateVariables): string {
    let result = text;

    // Replace {{variable}} patterns
    Object.entries(variables).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`;
      const stringValue = value !== null && value !== undefined ? String(value) : '';
      result = result.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), stringValue);
    });

    // Handle nested object properties like {{data.orderNumber}}
    const nestedPlaceholderRegex = /\{\{(\w+(?:\.\w+)+)\}\}/g;
    result = result.replace(nestedPlaceholderRegex, (match, path) => {
      try {
        const value = this.getNestedValue(variables, path);
        return value !== null && value !== undefined ? String(value) : '';
      } catch {
        logger.warn(`⚠️ Could not resolve placeholder: ${match}`);
        return match; // Keep original placeholder if resolution fails
      }
    });

    return result;
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private generateEmailHTML(message: string, eventType: string, variables: TemplateVariables): string {
    // Enhanced HTML template with better styling
    const eventIcon = this.getEventIcon(eventType);
    const eventColor = this.getEventColor(eventType);

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Notification from AI Outlet</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6; 
            color: #333; 
            max-width: 600px; 
            margin: 0 auto; 
            padding: 20px;
            background-color: #f5f5f5;
        }
        .email-container {
            background-color: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header { 
            background: linear-gradient(135deg, ${eventColor}, #667eea);
            color: white; 
            padding: 30px 20px; 
            text-align: center; 
        }
        .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 600;
        }
        .content { 
            padding: 30px 20px;
            background-color: white;
        }
        .message {
            font-size: 16px;
            line-height: 1.6;
            margin: 20px 0;
            color: #444;
        }
        .event-badge { 
            background-color: #e7f3ff; 
            color: #0066cc;
            padding: 8px 16px; 
            border-radius: 20px; 
            font-size: 14px; 
            display: inline-block; 
            margin-bottom: 20px;
            font-weight: 500;
        }
        .details-box {
            background-color: #f8f9fa;
            border-left: 4px solid ${eventColor};
            padding: 15px;
            margin: 20px 0;
            border-radius: 0 4px 4px 0;
        }
        .details-title {
            font-weight: 600;
            color: #333;
            margin-bottom: 10px;
        }
        .footer { 
            background-color: #2c3e50; 
            color: #bdc3c7; 
            padding: 20px; 
            text-align: center; 
            font-size: 14px;
        }
        .footer a {
            color: #3498db;
            text-decoration: none;
        }
        @media (max-width: 600px) {
            .email-container { margin: 10px; }
            .header, .content { padding: 20px 15px; }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <h1>${eventIcon} AI Outlet</h1>
        </div>
        <div class="content">
            <div class="event-badge">${eventType}</div>
            <div class="message">${message}</div>
            ${
              variables && Object.keys(variables).length > 0
                ? `
            <div class="details-box">
                <div class="details-title">📋 Details:</div>
                <div style="font-family: monospace; font-size: 14px; line-height: 1.4;">
                    ${Object.entries(variables)
                      .map(([key, value]) => `<div><strong>${key}:</strong> ${this.formatValue(value)}</div>`)
                      .join('')}
                </div>
            </div>
            `
                : ''
            }
        </div>
        <div class="footer">
            <p>This is an automated notification from AI Outlet.</p>
            <p style="margin: 10px 0 0 0;">
                Generated on ${new Date().toLocaleString()} | 
                <a href="#">Unsubscribe</a> | 
                <a href="#">Preferences</a>
            </p>
        </div>
    </div>
</body>
</html>
    `.trim();
  }

  private getEventIcon(eventType: string): string {
    const iconMap: { [key: string]: string } = {
      'order.placed': '🛍️',
      'order.delivered': '📦',
      'order.cancelled': '❌',
      'payment.received': '💳',
      'payment.failed': '⚠️',
      'profile.password_changed': '🔒',
      'profile.notification_preferences_updated': '⚙️',
      'profile.bank_details_updated': '🏦',
    };
    return iconMap[eventType] || '🔔';
  }

  private getEventColor(eventType: string): string {
    const colorMap: { [key: string]: string } = {
      'order.placed': '#4CAF50',
      'order.delivered': '#2196F3',
      'order.cancelled': '#f44336',
      'payment.received': '#4CAF50',
      'payment.failed': '#ff9800',
      'profile.password_changed': '#9c27b0',
      'profile.notification_preferences_updated': '#607d8b',
      'profile.bank_details_updated': '#795548',
    };
    return colorMap[eventType] || '#6c757d';
  }

  private formatValue(value: any): string {
    if (value === null || value === undefined) {
      return '<em>null</em>';
    }
    if (typeof value === 'object') {
      return `<code>${JSON.stringify(value)}</code>`;
    }
    return String(value);
  }
}

export default TemplateService;
