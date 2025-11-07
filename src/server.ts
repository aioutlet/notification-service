/**
 * Notification Service - HTTP Server
 * Provides health check endpoints for monitoring
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import Logger from './observability/logging/logger.js';
import config from './config/index.js';

const logger = new Logger();
const app = express();

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(cookieParser());

// Health check endpoints
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: process.env.NAME || 'notification-service',
    version: process.env.VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.get('/health/ready', (req, res) => {
  res.json({
    status: 'ready',
    service: process.env.NAME || 'notification-service',
    timestamp: new Date().toISOString(),
    checks: {
      server: { status: 'healthy' },
    },
  });
});

app.get('/health/live', (req, res) => {
  res.json({
    status: 'alive',
    service: process.env.NAME || 'notification-service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.get('/metrics', (req, res) => {
  const memoryUsage = process.memoryUsage();

  res.json({
    service: process.env.NAME || 'notification-service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      rss: memoryUsage.rss,
      heapTotal: memoryUsage.heapTotal,
      heapUsed: memoryUsage.heapUsed,
      external: memoryUsage.external,
    },
    nodeVersion: process.version,
    platform: process.platform,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested endpoint does not exist',
  });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('HTTP Server Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message || 'An unexpected error occurred',
  });
});

const PORT = parseInt(process.env.HEALTH_PORT || '3003', 10);
const HOST = process.env.HOST || '0.0.0.0';

export function startHealthServer(): void {
  app.listen(PORT, HOST, () => {
    logger.info(`🏥 Health check server running on ${HOST}:${PORT}`);
  });
}
