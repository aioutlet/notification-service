/**
 * Dapr Secret Management Service
 * Provides secret management using Dapr's secret store building block.
 * Falls back to environment variables if Dapr is not available.
 *
 * NOTE: Environment variables are loaded in server.ts before this module is imported
 */

import { DaprClient } from '@dapr/dapr';
import logger from '../core/logger.js';
import config from '../core/config.js';

class DaprSecretManager {
  private daprEnabled: boolean;
  private environment: string;
  private daprHost: string;
  private daprPort: string;
  private secretStoreName: string;

  constructor() {
    this.daprEnabled = (process.env.DAPR_ENABLED || 'true').toLowerCase() === 'true';
    this.environment = config.service.nodeEnv;
    this.daprHost = process.env.DAPR_HOST || '127.0.0.1';
    this.daprPort = process.env.DAPR_HTTP_PORT || '3503';

    // Use appropriate secret store based on environment
    if (this.environment === 'production') {
      this.secretStoreName = 'azure-keyvault-secret-store';
    } else {
      this.secretStoreName = 'local-secret-store';
    }

    logger.info('Secret manager initialized', {
      event: 'secret_manager_init',
      daprEnabled: this.daprEnabled,
      environment: this.environment,
      secretStore: this.secretStoreName,
    });
  }

  /**
   * Get a secret value
   * @param secretName - Name of the secret to retrieve
   * @returns Secret value or null if not found
   *
   * Priority:
   * 1. Dapr secret store (if enabled and available)
   * 2. Environment variable (fallback)
   */
  async getSecret(secretName: string): Promise<string | null> {
    // If Dapr is disabled, use environment variables
    if (!this.daprEnabled) {
      const value = process.env[secretName];
      if (value) {
        logger.debug('Retrieved secret from environment', {
          event: 'secret_retrieved',
          secretName,
          source: 'env',
        });
      }
      return value || null;
    }

    // Try Dapr secret store
    try {
      const client = new DaprClient({
        daprHost: this.daprHost,
        daprPort: this.daprPort,
      });

      const response = await client.secret.get(this.secretStoreName, secretName);

      // Handle different response types
      if (response && typeof response === 'object') {
        // Response is typically an object like { secretName: 'value' }
        const value = response[secretName];
        if (value !== undefined && value !== null) {
          logger.debug('Retrieved secret from Dapr', {
            event: 'secret_retrieved',
            secretName,
            source: 'dapr',
            store: this.secretStoreName,
          });
          return String(value);
        }

        // If not found by key, try getting first value
        const values = Object.values(response);
        if (values.length > 0 && values[0] !== undefined) {
          logger.debug('Retrieved secret from Dapr (first value)', {
            event: 'secret_retrieved',
            secretName,
            source: 'dapr',
            store: this.secretStoreName,
          });
          return String(values[0]);
        }
      }

      // If we get here, no value was found in Dapr
      logger.warn('Secret not found in Dapr store', {
        event: 'secret_not_found',
        secretName,
        store: this.secretStoreName,
      });
    } catch (error) {
      logger.warn(`Failed to get secret from Dapr: ${(error as Error).message}`, {
        event: 'secret_retrieval_error',
        secretName,
        error: (error as Error).message,
        store: this.secretStoreName,
      });
    }

    // Fallback to environment variable
    const value = process.env[secretName];
    if (value) {
      logger.debug('Retrieved secret from environment (fallback)', {
        event: 'secret_retrieved',
        secretName,
        source: 'env_fallback',
      });
    }
    return value || null;
  }

  /**
   * Get multiple secrets at once
   * @param secretNames - List of secret names to retrieve
   * @returns Object mapping secret names to their values
   */
  async getMultipleSecrets(secretNames: string[]): Promise<Record<string, string | null>> {
    const secrets: Record<string, string | null> = {};
    for (const name of secretNames) {
      secrets[name] = await this.getSecret(name);
    }
    return secrets;
  }

  /**
   * Get email configuration from secrets or environment variables
   * @returns Email configuration parameters
   */
  async getEmailConfig(): Promise<{
    smtpHost: string;
    smtpPort: number;
    smtpSecure: boolean;
    smtpUser: string;
    smtpPass: string;
  }> {
    const [host, port, secure, user, pass] = await Promise.all([
      this.getSecret('SMTP_HOST'),
      this.getSecret('SMTP_PORT'),
      this.getSecret('SMTP_SECURE'),
      this.getSecret('SMTP_USER'),
      this.getSecret('SMTP_PASS'),
    ]);

    return {
      smtpHost: host || 'localhost',
      smtpPort: parseInt(port || '1025', 10),
      smtpSecure: secure === 'true',
      smtpUser: user || '',
      smtpPass: pass || '',
    };
  }

  /**
   * Get message broker configuration from secrets or environment variables
   * @returns Message broker configuration parameters
   */
  async getMessageBrokerConfig(): Promise<{
    rabbitmqUrl: string;
    azureServiceBusConnectionString: string;
  }> {
    const [rabbitmqUrl, azureConnectionString] = await Promise.all([
      this.getSecret('RABBITMQ_URL'),
      this.getSecret('AZURE_SERVICEBUS_CONNECTION_STRING'),
    ]);

    return {
      rabbitmqUrl: rabbitmqUrl || 'amqp://guest:guest@localhost:5672',
      azureServiceBusConnectionString: azureConnectionString || '',
    };
  }
}

// Global instance
export const secretManager = new DaprSecretManager();

// Helper functions for easy access
export const getEmailConfig = () => secretManager.getEmailConfig();
export const getMessageBrokerConfig = () => secretManager.getMessageBrokerConfig();
