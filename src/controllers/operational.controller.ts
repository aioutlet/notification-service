/**
 * Operational/Infrastructure endpoints
 * These endpoints are used by monitoring systems, load balancers, and DevOps tools
 */

import DatabaseService from '../services/database.service';

export function health(req: any, res: any) {
  res.json({
    status: 'healthy',
    service: 'notification-service',
    timestamp: new Date().toISOString(),
    version: process.env.API_VERSION || '1.0.0',
  });
}

export async function readiness(req: any, res: any) {
  try {
    // Check database connectivity
    const dbService = DatabaseService.getInstance();
    await dbService.testConnection();

    res.json({
      status: 'ready',
      service: 'notification-service',
      timestamp: new Date().toISOString(),
      checks: {
        database: 'connected',
        // Add other dependency checks as needed
      },
    });
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      service: 'notification-service',
      timestamp: new Date().toISOString(),
      error: 'Service dependencies not available',
    });
  }
}

export function liveness(req: any, res: any) {
  // Liveness probe - just check if the app is running
  res.json({
    status: 'alive',
    service: 'notification-service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
}

export function metrics(req: any, res: any) {
  // Basic metrics endpoint (could be extended with prometheus metrics)
  const memUsage = process.memoryUsage();

  res.json({
    service: 'notification-service',
    timestamp: new Date().toISOString(),
    metrics: {
      uptime: process.uptime(),
      memory: {
        rss: memUsage.rss,
        heapTotal: memUsage.heapTotal,
        heapUsed: memUsage.heapUsed,
        external: memUsage.external,
        heapUsagePercent: ((memUsage.heapUsed / memUsage.heapTotal) * 100).toFixed(2) + '%',
      },
      pid: process.pid,
      nodeVersion: process.version,
    },
  });
}
