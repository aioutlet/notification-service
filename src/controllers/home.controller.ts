import { Request, Response } from 'express';
import config from '../config/index';
import logger from '../utils/logger';

export function getWelcomeMessage(req: Request, res: Response): void {
  logger.info('Welcome endpoint accessed');
  res.json({
    message: 'Welcome to the Notification Service',
  });
}

export function getVersion(req: Request, res: Response): void {
  logger.info('Version endpoint accessed');
  res.json({
    version: process.env.API_VERSION || '1.0.0',
  });
}

export function health(req: Request, res: Response): void {
  logger.info('Health check endpoint accessed');
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.server.env,
  });
}
