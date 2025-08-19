-- Notification Service Database Schema
-- MySQL schema for storing notification records

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    notification_id VARCHAR(255) NOT NULL UNIQUE,
    event_type VARCHAR(100) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    recipient_email VARCHAR(320), -- Max email length
    recipient_phone VARCHAR(20),
    subject VARCHAR(500),
    message TEXT NOT NULL,
    channel ENUM('email', 'sms', 'push', 'webhook') NOT NULL,
    status ENUM('pending', 'sent', 'failed', 'retry') NOT NULL DEFAULT 'pending',
    attempts INT NOT NULL DEFAULT 0,
    sent_at TIMESTAMP NULL,
    failed_at TIMESTAMP NULL,
    error_message TEXT,
    event_data JSON, -- Store event data as JSON
    template_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes for performance
    INDEX idx_notifications_notification_id (notification_id),
    INDEX idx_notifications_user_id (user_id),
    INDEX idx_notifications_event_type (event_type),
    INDEX idx_notifications_status (status),
    INDEX idx_notifications_channel (channel),
    INDEX idx_notifications_created_at (created_at),
    INDEX idx_notifications_user_status (user_id, status),
    INDEX idx_notifications_user_created (user_id, created_at)
);

-- Create notification_templates table for storing email/sms templates
CREATE TABLE IF NOT EXISTS notification_templates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    event_type VARCHAR(100) NOT NULL,
    channel ENUM('email', 'sms', 'push', 'webhook') NOT NULL,
    subject_template VARCHAR(500),
    message_template TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_templates_event_type (event_type),
    INDEX idx_templates_channel (channel),
    INDEX idx_templates_active (is_active),
    UNIQUE INDEX idx_templates_event_channel (event_type, channel)
);

-- Insert default templates for common events
INSERT IGNORE INTO notification_templates (name, event_type, channel, subject_template, message_template) VALUES
('user_registered_email', 'user.registered', 'email', 
 'Welcome to AI Outlet, {{user.name}}!', 
 'Hi {{user.name}},\n\nWelcome to AI Outlet! Your account has been successfully created.\n\nEmail: {{user.email}}\nRegistered at: {{timestamp}}\n\nBest regards,\nThe AI Outlet Team'),

('order_created_email', 'order.created', 'email', 
 'Order Confirmation - {{order.orderNumber}}', 
 'Hi {{user.name}},\n\nYour order has been successfully placed!\n\nOrder Number: {{order.orderNumber}}\nTotal Amount: ${{order.totalAmount}}\nOrder Date: {{timestamp}}\n\nWe will notify you once your order is processed.\n\nBest regards,\nThe AI Outlet Team'),

('order_shipped_email', 'order.shipped', 'email', 
 'Your Order is Shipped - {{order.orderNumber}}', 
 'Hi {{user.name}},\n\nGreat news! Your order has been shipped.\n\nOrder Number: {{order.orderNumber}}\nTracking Number: {{order.trackingNumber}}\nEstimated Delivery: {{order.estimatedDelivery}}\n\nYou can track your package using the tracking number above.\n\nBest regards,\nThe AI Outlet Team'),

('order_delivered_email', 'order.delivered', 'email', 
 'Order Delivered - {{order.orderNumber}}', 
 'Hi {{user.name}},\n\nYour order has been delivered successfully!\n\nOrder Number: {{order.orderNumber}}\nDelivered at: {{timestamp}}\n\nThank you for shopping with AI Outlet. We hope you love your purchase!\n\nBest regards,\nThe AI Outlet Team'),

('payment_failed_email', 'payment.failed', 'email', 
 'Payment Failed - Order {{order.orderNumber}}', 
 'Hi {{user.name}},\n\nWe were unable to process your payment for order {{order.orderNumber}}.\n\nReason: {{payment.errorMessage}}\nAmount: ${{order.totalAmount}}\n\nPlease update your payment information and try again.\n\nBest regards,\nThe AI Outlet Team');
