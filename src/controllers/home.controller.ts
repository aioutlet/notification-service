/**
 * Home Controller
 * Handles service information and version endpoints
 */

import { Request, Response } from 'express';
import config from '../core/config.js';

/**
 * Service information endpoint
 */
export const info = (_req: Request, res: Response): void => {
  res.json({
    message: 'Welcome to the Notification Service',
    service: config.service.name,
    description: 'Event-driven notification service for xshopai platform',
    version: config.service.version,
    environment: config.service.nodeEnv,
    capabilities: [
      'Event consumption via Dapr pub/sub',
      'Email notifications via SMTP',
      'SMS notifications',
      'Push notifications',
      'W3C Trace Context propagation',
    ],
  });
};

/**
 * Service version endpoint
 */
export const version = (_req: Request, res: Response): void => {
  res.json({
    service: config.service.name,
    version: config.service.version,
    environment: config.service.nodeEnv,
    nodeVersion: process.version,
  });
};
