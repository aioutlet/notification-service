import { Router, Request, Response } from 'express';
import database from '../database/connection';
import logger from '../utils/logger';

const router = Router();

/**
 * Basic health check
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      environment: process.env.NODE_ENV || 'development',
    };

    res.status(200).json(health);
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
    });
  }
});

/**
 * Detailed health check
 */
router.get('/detailed', async (req: Request, res: Response): Promise<void> => {
  try {
    const startTime = Date.now();

    // Check database connection
    const dbHealthy = await database.testConnection();
    const dbLatency = Date.now() - startTime;

    const health = {
      status: dbHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      environment: process.env.NODE_ENV || 'development',
      services: {
        database: {
          status: dbHealthy ? 'healthy' : 'unhealthy',
          latency: `${dbLatency}ms`,
        },
      },
    };

    const statusCode = dbHealthy ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    logger.error('Detailed health check failed:', error);
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      services: {
        database: {
          status: 'unknown',
          error: 'Connection check failed',
        },
      },
    });
  }
});

/**
 * Readiness probe
 */
router.get('/ready', async (req: Request, res: Response): Promise<void> => {
  try {
    // Check if all required services are ready
    const dbReady = await database.testConnection();

    if (dbReady) {
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(503).json({
        status: 'not ready',
        timestamp: new Date().toISOString(),
        reason: 'Database not ready',
      });
    }
  } catch (error) {
    logger.error('Readiness check failed:', error);
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      error: 'Readiness check failed',
    });
  }
});

/**
 * Liveness probe
 */
router.get('/live', (req: Request, res: Response): void => {
  // Simple liveness check - if we can respond, we're alive
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    pid: process.pid,
  });
});

export default router;
