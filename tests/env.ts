// Test environment variables
// This file runs before Jest is initialized

process.env.NODE_ENV = 'test';
process.env.PORT = '0'; // Let the system assign a port for testing
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '3306';
process.env.DB_NAME = 'notification_service_test';
process.env.DB_USER = 'test_user';
process.env.DB_PASSWORD = 'test_pass';
process.env.EMAIL_ENABLED = 'false';
process.env.RABBITMQ_URL = 'amqp://localhost:5672';
