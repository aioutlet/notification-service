import { Request, Response } from 'express';
import config from '../config/index.js';
import logger from '../observability/logging/index.js';

export function getWelcomeMessage(req: Request, res: Response): void {
  logger.info('Welcome endpoint accessed');
  res.json({
    message: '🔔 Notification Service API',
    version: process.env.npm_package_version || '1.0.0',
    environment: config.server.env,
    endpoints: {
      health: '/api/home/health',
      version: '/api/home/version',
      metrics: '/api/monitoring/metrics',
      stats: '/api/monitoring/stats',
      healthDetailed: '/api/monitoring/health',
      liveness: '/api/monitoring/health/live',
      readiness: '/api/monitoring/health/ready',
      notifications: '/api/notifications',
      templates: '/api/templates',
    },
  });
}

export function getVersion(req: Request, res: Response): void {
  logger.info('Version endpoint accessed');
  res.json({
    name: 'notification-service',
    version: process.env.npm_package_version || '1.0.0',
    environment: config.server.env,
    node: process.version,
  });
}

export function health(req: Request, res: Response): void {
  logger.info('Health check endpoint accessed');
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
  });
}
