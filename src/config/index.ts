import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface Config {
  server: {
    port: number;
    host: string;
    env: string;
    serviceName: string;
    serviceVersion: string;
  };
  messageBroker: {
    type: 'rabbitmq' | 'kafka' | 'azure-servicebus';
    rabbitmq?: {
      url: string;
      exchange: string;
      queues: {
        notifications: string;
        email: string;
        sms: string;
        push: string;
      };
    };
    kafka?: {
      brokers: string[];
      clientId: string;
      groupId: string;
      topics: {
        notifications: string;
        email: string;
        sms: string;
        push: string;
      };
    };
    azureServiceBus?: {
      connectionString: string;
      queues: {
        notifications: string;
        email: string;
        sms: string;
        push: string;
      };
    };
  };
  email: {
    provider: string;
    smtp: {
      host: string;
      port: number;
      secure: boolean;
      auth: {
        user: string;
        pass: string;
      };
    };
    from: {
      name: string;
      address: string;
    };
    enabled: boolean;
  };
}

const brokerType = (process.env.MESSAGE_BROKER_TYPE || 'rabbitmq') as 'rabbitmq' | 'kafka' | 'azure-servicebus';

const config: Config = {
  server: {
    port: parseInt(process.env.PORT || '3003'),
    host: process.env.HOST || 'localhost',
    env: process.env.NODE_ENV || 'development',
    serviceName: process.env.SERVICE_NAME || 'notification-service',
    serviceVersion: process.env.SERVICE_VERSION || '1.0.0',
  },
  messageBroker: {
    type: brokerType,
    ...(brokerType === 'rabbitmq' && {
      rabbitmq: {
        url: process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672',
        exchange: process.env.RABBITMQ_EXCHANGE || 'aioutlet.events',
        queues: {
          notifications: process.env.RABBITMQ_QUEUE_NOTIFICATIONS || 'notifications',
          email: process.env.RABBITMQ_QUEUE_EMAIL || 'notifications.email',
          sms: process.env.RABBITMQ_QUEUE_SMS || 'notifications.sms',
          push: process.env.RABBITMQ_QUEUE_PUSH || 'notifications.push',
        },
      },
    }),
    ...(brokerType === 'kafka' && {
      kafka: {
        brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
        clientId: process.env.KAFKA_CLIENT_ID || 'notification-service',
        groupId: process.env.KAFKA_GROUP_ID || 'notification-service-group',
        topics: {
          notifications: process.env.KAFKA_TOPIC_NOTIFICATIONS || 'notifications',
          email: process.env.KAFKA_TOPIC_EMAIL || 'notifications.email',
          sms: process.env.KAFKA_TOPIC_SMS || 'notifications.sms',
          push: process.env.KAFKA_TOPIC_PUSH || 'notifications.push',
        },
      },
    }),
    ...(brokerType === 'azure-servicebus' && {
      azureServiceBus: {
        connectionString: process.env.AZURE_SERVICEBUS_CONNECTION_STRING || '',
        queues: {
          notifications: process.env.AZURE_SERVICEBUS_QUEUE_NOTIFICATIONS || 'notifications',
          email: process.env.AZURE_SERVICEBUS_QUEUE_EMAIL || 'notifications-email',
          sms: process.env.AZURE_SERVICEBUS_QUEUE_SMS || 'notifications-sms',
          push: process.env.AZURE_SERVICEBUS_QUEUE_PUSH || 'notifications-push',
        },
      },
    }),
  },
  email: {
    provider: process.env.EMAIL_PROVIDER || 'smtp',
    smtp: {
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '1025'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
      },
    },
    from: {
      name: process.env.EMAIL_FROM_NAME || 'AI Outlet Notifications',
      address: process.env.EMAIL_FROM_ADDRESS || 'noreply@aioutlet.local',
    },
    enabled: process.env.EMAIL_ENABLED !== 'false',
  },
};

export default config;
