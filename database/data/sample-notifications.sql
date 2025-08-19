-- Sample notification data for testing
-- This file contains test notifications to verify the system is working

-- Insert some sample notifications
INSERT IGNORE INTO notifications (
    notification_id, event_type, user_id, recipient_email, 
    subject, message, channel, status, attempts, event_data
) VALUES 
(
    'notif_sample_001', 
    'user.registered', 
    'user_12345', 
    'test@example.com',
    'Welcome to AI Outlet!',
    'Hi there,\n\nWelcome to AI Outlet! Your account has been successfully created.\n\nBest regards,\nThe AI Outlet Team',
    'email',
    'sent',
    1,
    JSON_OBJECT('user', JSON_OBJECT('name', 'Test User', 'email', 'test@example.com'), 'timestamp', '2024-01-15T10:00:00Z')
),
(
    'notif_sample_002', 
    'order.created', 
    'user_12345', 
    'test@example.com',
    'Order Confirmation - ORD001',
    'Hi there,\n\nYour order has been successfully placed!\n\nOrder Number: ORD001\nTotal Amount: $99.99\n\nBest regards,\nThe AI Outlet Team',
    'email',
    'pending',
    0,
    JSON_OBJECT('order', JSON_OBJECT('orderNumber', 'ORD001', 'totalAmount', 99.99), 'user', JSON_OBJECT('name', 'Test User'), 'timestamp', '2024-01-15T11:00:00Z')
),
(
    'notif_sample_003', 
    'order.shipped', 
    'user_67890', 
    'customer@example.com',
    'Your Order is Shipped - ORD002',
    'Hi Customer,\n\nYour order has been shipped!\n\nOrder Number: ORD002\nTracking Number: TRK123456789\n\nBest regards,\nThe AI Outlet Team',
    'email',
    'failed',
    2,
    JSON_OBJECT('order', JSON_OBJECT('orderNumber', 'ORD002', 'trackingNumber', 'TRK123456789'), 'user', JSON_OBJECT('name', 'Customer'), 'timestamp', '2024-01-15T12:00:00Z')
);
