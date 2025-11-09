/**
 * Dapr Client and Server Helper
 * Provides utilities for Dapr service invocation, pub/sub, and server initialization
 */
import { DaprClient, DaprServer, CommunicationProtocolEnum } from '@dapr/dapr';
import config from '../core/config.js';
import logger from '../core/logger.js';

class DaprClientHelper {
  private client: DaprClient | null = null;
  private server: DaprServer | null = null;
  private daprEnabled: boolean;

  constructor() {
    this.daprEnabled = (process.env.DAPR_ENABLED || 'true').toLowerCase() === 'true';
  }

  getClient(): DaprClient {
    if (!this.daprEnabled) {
      throw new Error('Dapr is disabled. Set DAPR_ENABLED=true to use Dapr features.');
    }

    if (!this.client) {
      this.client = new DaprClient({
        daprHost: config.dapr.host,
        daprPort: String(config.dapr.httpPort),
        communicationProtocol: CommunicationProtocolEnum.HTTP,
      });
      logger.info('Dapr client initialized', {
        host: config.dapr.host,
        port: config.dapr.httpPort,
      });
    }
    return this.client;
  }

  getServer(): DaprServer {
    if (!this.daprEnabled) {
      throw new Error('Dapr is disabled. Set DAPR_ENABLED=true to use Dapr features.');
    }

    if (!this.server) {
      this.server = new DaprServer({
        serverHost: config.service.host,
        serverPort: String(config.dapr.appPort),
        clientOptions: {
          daprHost: config.dapr.host,
          daprPort: String(config.dapr.httpPort),
        },
      });
      logger.info('Dapr server initialized', {
        appPort: config.dapr.appPort,
        daprHost: config.dapr.host,
        daprPort: config.dapr.httpPort,
      });
    }
    return this.server;
  }

  isDaprEnabled(): boolean {
    return this.daprEnabled;
  }

  /**
   * Publish event to Dapr pub/sub
   */
  async publishEvent(pubsubName: string, topic: string, data: any): Promise<void> {
    try {
      logger.debug('Publishing event via Dapr', { pubsubName, topic });

      const client = this.getClient();
      await client.pubsub.publish(pubsubName, topic, data);

      logger.info('Event published successfully', { pubsubName, topic });
    } catch (error) {
      logger.error('Failed to publish event', { error, pubsubName, topic });
      throw error;
    }
  }

  /**
   * Invoke another service using Dapr service invocation
   */
  async invokeService(
    appId: string,
    methodName: string,
    httpMethod: string = 'GET',
    data: any = null,
    metadata: Record<string, string> = {}
  ): Promise<any> {
    try {
      logger.debug('Invoking service via Dapr', { appId, methodName, httpMethod, ...metadata });

      const client = this.getClient();
      const response = await client.invoker.invoke(appId, methodName, httpMethod as any, data, metadata);

      logger.info('Service invocation successful', { appId, methodName });

      return response;
    } catch (error) {
      logger.error('Service invocation failed', { error, appId, methodName });
      throw error;
    }
  }

  /**
   * Get Dapr metadata
   */
  async getMetadata(): Promise<any> {
    try {
      const client = this.getClient();
      const metadata = await client.metadata.get();
      return metadata;
    } catch (error) {
      logger.error('Failed to get Dapr metadata', { error });
      throw error;
    }
  }
}

// Export singleton instance
export const daprClient = new DaprClientHelper();
export default daprClient;
