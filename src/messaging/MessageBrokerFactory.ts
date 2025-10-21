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
    const brokerType = config.messageBroker.type;

    logger.info(`Creating message broker: ${brokerType}`);

    switch (brokerType) {
      case 'rabbitmq':
        if (!config.messageBroker.rabbitmq) {
          throw new Error('RabbitMQ configuration is missing');
        }
        return new RabbitMQBroker(
          config.messageBroker.rabbitmq.url,
          config.messageBroker.rabbitmq.queues.notifications
        );

      case 'kafka': {
        if (!config.messageBroker.kafka) {
          throw new Error('Kafka configuration is missing');
        }
        return new KafkaBroker(
          config.messageBroker.kafka.brokers,
          [config.messageBroker.kafka.topics.notifications],
          config.messageBroker.kafka.groupId
        );
      }

      case 'azure-servicebus':
        throw new Error('Azure Service Bus broker not yet implemented');

      default:
        throw new Error(`Unsupported message broker type: ${brokerType}`);
    }
  }
}
