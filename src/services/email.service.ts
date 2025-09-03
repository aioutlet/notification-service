import nodemailer from 'nodemailer';
import config from '../config/index.js';
import logger from '../observability/logging/index.js';

export interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  from?: {
    name: string;
    address: string;
  };
}

export interface EmailProvider {
  sendEmail(options: EmailOptions): Promise<boolean>;
  isConfigured(): boolean;
}

class SMTPEmailProvider implements EmailProvider {
  private transporter: nodemailer.Transporter | null = null;
  private configured: boolean = false;

  constructor() {
    this.initializeTransporter();
  }

  private initializeTransporter(): void {
    try {
      if (!config.email.smtp.auth.user || !config.email.smtp.auth.pass) {
        logger.warn('⚠️ SMTP credentials not configured. Email sending will be disabled.');
        this.configured = false;
        return;
      }

      this.transporter = nodemailer.createTransport({
        host: config.email.smtp.host,
        port: config.email.smtp.port,
        secure: config.email.smtp.secure,
        auth: {
          user: config.email.smtp.auth.user,
          pass: config.email.smtp.auth.pass,
        },
        // Add some additional options for better compatibility
        tls: {
          rejectUnauthorized: false, // Accept self-signed certificates (for development)
        },
      });

      this.configured = true;
      logger.info('✅ SMTP email provider initialized successfully');
    } catch (error) {
      logger.error('❌ Failed to initialize SMTP transporter:', error);
      this.configured = false;
    }
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    const startTime = Date.now();

    if (!this.configured || !this.transporter) {
      logger.error('❌ SMTP provider not configured. Cannot send email.');
      return false;
    }

    try {
      const fromAddress = options.from || config.email.from;

      const mailOptions = {
        from: `"${fromAddress.name}" <${fromAddress.address}>`,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html || options.text, // Use HTML if provided, otherwise fallback to text
      };

      const info = await this.transporter.sendMail(mailOptions);
      const duration = Date.now() - startTime;

      logger.info('📧 Email sent successfully:', {
        to: options.to,
        subject: options.subject,
        messageId: info.messageId,
        duration: `${duration}ms`,
      });

      return true;
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('❌ Failed to send email:', {
        to: options.to,
        subject: options.subject,
        error: error instanceof Error ? error.message : error,
        duration: `${duration}ms`,
      });
      return false;
    }
  }

  isConfigured(): boolean {
    return this.configured;
  }

  async testConnection(): Promise<boolean> {
    if (!this.configured || !this.transporter) {
      return false;
    }

    try {
      await this.transporter.verify();
      logger.info('✅ SMTP connection test successful');
      return true;
    } catch (error) {
      logger.error('❌ SMTP connection test failed:', error);
      return false;
    }
  }
}

// Factory class to create different email providers
class EmailServiceFactory {
  static createProvider(providerType: string = 'smtp'): EmailProvider {
    switch (providerType.toLowerCase()) {
      case 'smtp':
        return new SMTPEmailProvider();
      // Future providers can be added here:
      // case 'sendgrid':
      //   return new SendGridEmailProvider();
      // case 'ses':
      //   return new SESEmailProvider();
      default:
        logger.warn(`⚠️ Unknown email provider: ${providerType}. Falling back to SMTP.`);
        return new SMTPEmailProvider();
    }
  }
}

class EmailService {
  private provider: EmailProvider;
  private enabled: boolean;

  constructor() {
    this.enabled = config.email.enabled;
    this.provider = EmailServiceFactory.createProvider(config.email.provider);

    if (!this.enabled) {
      logger.info('📧 Email service is disabled via configuration');
    } else if (!this.provider.isConfigured()) {
      logger.warn('⚠️ Email service is enabled but provider is not properly configured');
      this.enabled = false;
    }
  }

  async sendNotificationEmail(
    recipientEmail: string,
    subject: string,
    message: string,
    eventType: string,
    eventData?: any
  ): Promise<boolean> {
    if (!this.enabled) {
      logger.debug('📧 Email sending skipped (service disabled)');
      return false;
    }

    try {
      // Generate HTML email content
      const htmlContent = this.generateEmailHTML(message, eventType, eventData);

      const emailOptions: EmailOptions = {
        to: recipientEmail,
        subject,
        text: message,
        html: htmlContent,
      };

      return await this.provider.sendEmail(emailOptions);
    } catch (error) {
      logger.error('❌ Failed to send notification email:', error);
      return false;
    }
  }

  private generateEmailHTML(message: string, eventType: string, eventData?: any): string {
    // Basic HTML template - this can be enhanced with proper templates later
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Notification from AI Outlet</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
        .footer { background-color: #333; color: white; padding: 10px; text-align: center; font-size: 12px; border-radius: 0 0 5px 5px; }
        .event-type { background-color: #e7f3ff; padding: 5px 10px; border-radius: 3px; font-size: 12px; display: inline-block; margin-bottom: 10px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔔 AI Outlet Notification</h1>
    </div>
    <div class="content">
        <div class="event-type">Event: ${eventType}</div>
        <div style="font-size: 16px; margin: 20px 0;">
            ${message}
        </div>
        ${
          eventData
            ? `
        <div style="margin-top: 20px; padding: 10px; background-color: #fff; border-left: 4px solid #4CAF50;">
            <strong>Event Details:</strong><br>
            <code style="background-color: #f4f4f4; padding: 10px; display: block; margin-top: 5px; border-radius: 3px;">
                ${JSON.stringify(eventData, null, 2)}
            </code>
        </div>
        `
            : ''
        }
    </div>
    <div class="footer">
        <p>This is an automated notification from AI Outlet. Please do not reply to this email.</p>
        <p style="margin: 5px 0;">Generated at ${new Date().toISOString()}</p>
    </div>
</body>
</html>
    `.trim();
  }

  async testEmailService(): Promise<boolean> {
    if (!this.enabled) {
      logger.info('📧 Email service test skipped (service disabled)');
      return false;
    }

    if (this.provider instanceof SMTPEmailProvider) {
      return await this.provider.testConnection();
    }

    return this.provider.isConfigured();
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getProviderInfo(): { provider: string; configured: boolean; enabled: boolean } {
    return {
      provider: config.email.provider,
      configured: this.provider.isConfigured(),
      enabled: this.enabled,
    };
  }
}

export default EmailService;
