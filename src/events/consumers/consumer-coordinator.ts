/**
 * Event Consumer Coordinator
 * Coordinates all event consumers and manages subscription registration
 */

import { DaprServer } from '@dapr/dapr';
import logger from '../../core/logger.js';
import { AuthEventConsumer } from './auth-consumer.js';
import { UserEventConsumer } from './user-consumer.js';
import { OrderEventConsumer } from './order-consumer.js';
import { PaymentEventConsumer } from './payment-consumer.js';

export class EventConsumerCoordinator {
  private daprServer: DaprServer;
  private authConsumer: AuthEventConsumer;
  private userConsumer: UserEventConsumer;
  private orderConsumer: OrderEventConsumer;
  private paymentConsumer: PaymentEventConsumer;

  constructor(daprServer: DaprServer) {
    this.daprServer = daprServer;
    this.authConsumer = new AuthEventConsumer(daprServer);
    this.userConsumer = new UserEventConsumer(daprServer);
    this.orderConsumer = new OrderEventConsumer(daprServer);
    this.paymentConsumer = new PaymentEventConsumer(daprServer);
  }

  /**
   * Register all event subscriptions from all consumers
   */
  async registerSubscriptions(): Promise<void> {
    logger.info('Registering Dapr event subscriptions');

    await this.authConsumer.registerSubscriptions();
    await this.userConsumer.registerSubscriptions();
    await this.orderConsumer.registerSubscriptions();
    await this.paymentConsumer.registerSubscriptions();

    logger.info('All Dapr event subscriptions registered successfully');
  }
}
