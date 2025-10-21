/**
 * Message Broker Interface
 * Defines the contract for all message broker implementations (RabbitMQ, Kafka, etc.)
 * This abstraction allows easy switching between different message brokers without changing business logic.
 */

export interface IMessageBroker {
  /**
   * Establish connection to the message broker
   * @returns Promise that resolves when connection is established
   */
  connect(): Promise<void>;

  /**
   * Start consuming messages from configured queues/topics
   * @returns Promise that resolves when consumers are started
   */
  startConsuming(): Promise<void>;

  /**
   * Register event handler for specific event types
   * @param eventType - The type of event to handle
   * @param handler - Function to process the event
   */
  registerEventHandler(eventType: string, handler: (eventData: any, correlationId: string) => Promise<void>): void;

  /**
   * Publish an event to the message broker
   * @param eventType - The type of event to publish
   * @param eventData - The event data payload
   * @param correlationId - Optional correlation ID for tracing
   * @returns Promise that resolves when event is published
   */
  publishEvent(eventType: string, eventData: any, correlationId?: string): Promise<void>;

  /**
   * Close connection to the message broker
   * @returns Promise that resolves when connection is closed
   */
  close(): Promise<void>;

  /**
   * Check if the broker connection is healthy
   * @returns true if connected and ready, false otherwise
   */
  isHealthy(): boolean;

  /**
   * Get queue/topic statistics (optional, for monitoring)
   * @returns Promise with statistics object
   */
  getStats?(): Promise<any>;
}
