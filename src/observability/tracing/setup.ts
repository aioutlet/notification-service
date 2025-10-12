// OpenTelemetry tracing setup for notification-service
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import process from 'process';

// SDK initialization
let sdk: NodeSDK | null = null;
const environment = process.env.NODE_ENV || 'development';
const enableTracing = process.env.ENABLE_TRACING !== 'false' && environment !== 'test';

/**
 * Initialize OpenTelemetry SDK
 * @returns True if initialization was successful
 */
export function initializeTracing(): boolean {
  if (!enableTracing) {
    return false;
  }

  if (sdk) {
    return true; // Already initialized
  }

  try {
    sdk = new NodeSDK({
      traceExporter: new OTLPTraceExporter({
        url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
        headers: {},
      }),
      serviceName: process.env.SERVICE_NAME || process.env.OTEL_SERVICE_NAME || 'notification-service',
      instrumentations: [
        getNodeAutoInstrumentations({
          // Disable file system instrumentation that can be noisy
          '@opentelemetry/instrumentation-fs': {
            enabled: false,
          },
        }),
      ],
    });

    sdk.start();
    console.log('[TRACING] ✅ OpenTelemetry tracing initialized successfully');
    return true;
  } catch (error) {
    console.warn('[TRACING] ⚠️  Failed to initialize OpenTelemetry:', (error as Error).message);
    return false;
  }
}

/**
 * Shutdown OpenTelemetry SDK
 * @returns Promise<void>
 */
export function shutdownTracing(): Promise<void> {
  if (sdk) {
    return sdk
      .shutdown()
      .then(() => console.log('Tracing terminated'))
      .catch((error) => console.error('Error terminating tracing', error));
  }
  return Promise.resolve();
}

/**
 * Check if tracing is enabled
 * @returns True if tracing is enabled
 */
export function isTracingEnabled(): boolean {
  return enableTracing;
}
