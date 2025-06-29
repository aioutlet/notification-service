-- Notification Service Database Schema

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    notification_id VARCHAR(100) UNIQUE NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    user_id VARCHAR(100) NOT NULL,
    recipient_email VARCHAR(255),
    recipient_phone VARCHAR(50),
    subject VARCHAR(255),
    message TEXT NOT NULL,
    channel ENUM('email', 'sms', 'push', 'webhook') NOT NULL DEFAULT 'email',
    status ENUM('pending', 'sent', 'failed', 'retry') NOT NULL DEFAULT 'pending',
    attempts INT DEFAULT 0,
    sent_at TIMESTAMP NULL,
    failed_at TIMESTAMP NULL,
    error_message TEXT,
    event_data JSON,
    template_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_user_id (user_id),
    INDEX idx_event_type (event_type),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at),
    INDEX idx_notification_id (notification_id),
    INDEX idx_template_id (template_id)
);

-- Create notification templates table (for future use)
CREATE TABLE IF NOT EXISTS notification_templates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    channel ENUM('email', 'sms', 'push', 'webhook') NOT NULL,
    template_name VARCHAR(100) NOT NULL,
    subject VARCHAR(255),
    message_template TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_event_channel (event_type, channel),
    INDEX idx_event_type (event_type),
    INDEX idx_channel (channel),
    INDEX idx_active (is_active)
);

-- Create user notification preferences table (for future use)
CREATE TABLE IF NOT EXISTS user_notification_preferences (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    email_enabled BOOLEAN DEFAULT TRUE,
    sms_enabled BOOLEAN DEFAULT FALSE,
    push_enabled BOOLEAN DEFAULT TRUE,
    webhook_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_user_event (user_id, event_type),
    INDEX idx_user_id (user_id),
    INDEX idx_event_type (event_type)
);

-- Insert default notification templates
INSERT INTO notification_templates (event_type, channel, template_name, subject, message_template) VALUES
('order.placed', 'email', 'Order Placed', 'Order Confirmation - {{orderNumber}}', 'Your order #{{orderNumber}} has been placed successfully! Total: ${{amount}}'),
('order.delivered', 'email', 'Order Delivered', 'Order Delivered - {{orderNumber}}', 'Your order #{{orderNumber}} has been delivered successfully!'),
('order.cancelled', 'email', 'Order Cancelled', 'Order Cancelled - {{orderNumber}}', 'Your order #{{orderNumber}} has been cancelled.'),
('payment.received', 'email', 'Payment Received', 'Payment Confirmation', 'Payment of ${{amount}} has been received for your order.'),
('payment.failed', 'email', 'Payment Failed', 'Payment Failed', 'Payment failed for your order. Please try again.'),
('profile.password_changed', 'email', 'Password Changed', 'Password Changed', 'Your password has been changed successfully.'),
('profile.notification_preferences_updated', 'email', 'Preferences Updated', 'Notification Preferences Updated', 'Your notification preferences have been updated.'),
('profile.bank_details_updated', 'email', 'Bank Details Updated', 'Bank Details Updated', 'Your bank details have been updated successfully.');

-- Insert SMS templates
INSERT INTO notification_templates (event_type, channel, template_name, message_template) VALUES
('order.placed', 'sms', 'Order Placed SMS', 'Order #{{orderNumber}} placed successfully! Total: ${{amount}}'),
('order.delivered', 'sms', 'Order Delivered SMS', 'Order #{{orderNumber}} delivered!'),
('payment.received', 'sms', 'Payment Received SMS', 'Payment of ${{amount}} received.'),
('payment.failed', 'sms', 'Payment Failed SMS', 'Payment failed. Please try again.');

-- Create indexes for better performance
CREATE INDEX idx_notifications_user_status ON notifications(user_id, status);
CREATE INDEX idx_notifications_event_created ON notifications(event_type, created_at);
