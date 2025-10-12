/**
 * Message Broker Factory
 * Creates the appropriate message broker instance based on configuration
 */

import { IMessageBroker } from './IMessageBroker.js';
import { RabbitMQBroker } from './brokers/RabbitMQBroker.js';
import { KafkaBroker } from './brokers/KafkaBroker.js';
import config from '../config/index.js';
import logger from '../observability/logging/index.js';

export class MessageBrokerFactory {
  /**
   * Create a message broker instance based on MESSAGE_BROKER_TYPE environment variable
   * @returns IMessageBroker implementation
   */
  static create(): IMessageBroker {
    const brokerType = process.env.MESSAGE_BROKER_TYPE || 'rabbitmq';

    logger.info(`Creating message broker: ${brokerType}`);

    switch (brokerType.toLowerCase()) {
      case 'rabbitmq':
        return new RabbitMQBroker(config.rabbitmq.url, config.rabbitmq.queues.notifications);

      case 'kafka': {
        // Parse Kafka brokers from comma-separated list
        const kafkaBrokers = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
        const kafkaTopics = (process.env.KAFKA_TOPICS || 'aioutlet.events').split(',');
        const kafkaGroupId = process.env.KAFKA_GROUP_ID || 'notification-service-group';

        return new KafkaBroker(kafkaBrokers, kafkaTopics, kafkaGroupId);
      }

      default:
        throw new Error(`Unsupported message broker type: ${brokerType}. Supported types: rabbitmq, kafka`);
    }
  }
}
