/**
 * Health Check Server
 * Provides health check and Dapr subscription endpoints
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { DaprServer } from '@dapr/dapr';
import logger from './core/logger.js';
import config from './core/config.js';
import { daprClient } from './clients/index.js';
import { traceContextMiddleware } from './middlewares/traceContext.middleware.js';
import operationalRoutes from './routes/operational.routes.js';
import daprRoutes from './routes/dapr.routes.js';

const app = express();
let daprServer: DaprServer | null = null;

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use(traceContextMiddleware as express.RequestHandler); // W3C Trace Context

// Register routes
app.use(operationalRoutes); // Health, readiness, liveness, metrics
app.use(daprRoutes); // Dapr subscription

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested endpoint does not exist',
  });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('HTTP Server Error', { error: err });
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message || 'An unexpected error occurred',
  });
});

export function startHealthServer(): void {
  const PORT = config.service.port;
  const HOST = config.service.host;

  app.listen(PORT, HOST, () => {
    logger.info(`Health check server running on ${HOST}:${PORT}`);
  });
}

/**
 * Initialize Dapr server for event subscriptions
 */
export async function initializeDaprServer(): Promise<DaprServer> {
  daprServer = daprClient.getServer();

  logger.info('Dapr server initialized', {
    daprHost: config.dapr.host,
    daprPort: config.dapr.httpPort,
    appPort: config.dapr.appPort,
  });

  return daprServer;
}

export function getDaprServer(): DaprServer | null {
  return daprServer;
}
