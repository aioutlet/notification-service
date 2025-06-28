import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface Config {
  server: {
    port: number;
    host: string;
    env: string;
  };
  database: {
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
  };
  rabbitmq: {
    url: string;
    exchanges: {
      order: string;
      user: string;
    };
    queues: {
      notifications: string;
    };
  };
}

const config: Config = {
  server: {
    port: parseInt(process.env.PORT || '3003'),
    host: process.env.HOST || 'localhost',
    env: process.env.NODE_ENV || 'development',
  },
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    name: process.env.DB_NAME || 'notification_service_dev',
    user: process.env.DB_USER || 'notification_user',
    password: process.env.DB_PASSWORD || 'notification_pass',
  },
  rabbitmq: {
    url: process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672',
    exchanges: {
      order: process.env.RABBITMQ_EXCHANGE_ORDER || 'order.events',
      user: process.env.RABBITMQ_EXCHANGE_USER || 'user.events',
    },
    queues: {
      notifications: process.env.RABBITMQ_QUEUE_NOTIFICATIONS || 'notifications',
    },
  },
};

export default config;
