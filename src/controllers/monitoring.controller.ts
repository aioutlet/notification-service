import { Request, Response } from 'express';
import MonitoringService from '../services/monitoring.service';
import DatabaseService from '../services/database.service';
import EmailService from '../services/email.service';
import logger from '../utils/logger';

class MonitoringController {
  private monitoringService: MonitoringService;
  private dbService: DatabaseService;
  private emailService: EmailService;

  constructor() {
    this.monitoringService = MonitoringService.getInstance();
    this.dbService = DatabaseService.getInstance();
    this.emailService = new EmailService();
    this.setupHealthChecks();
  }

  private setupHealthChecks(): void {
    // Database health check
    this.monitoringService.registerHealthCheck('database', async () => {
      try {
        await this.dbService.testConnection();
        return { status: 'pass', message: 'Database connection healthy' };
      } catch (error) {
        return {
          status: 'fail',
          message: `Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    });

    // Email service health check
    this.monitoringService.registerHealthCheck('email', async () => {
      try {
        if (!this.emailService.isEnabled()) {
          return { status: 'warn', message: 'Email service is disabled' };
        }

        // Basic connectivity check (this could be enhanced with actual SMTP test)
        return { status: 'pass', message: 'Email service configured and enabled' };
      } catch (error) {
        return {
          status: 'fail',
          message: `Email service check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    });

    // Memory usage health check
    this.monitoringService.registerHealthCheck('memory', async () => {
      const memUsage = process.memoryUsage();
      const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
      const heapTotalMB = memUsage.heapTotal / 1024 / 1024;
      const usagePercent = (heapUsedMB / heapTotalMB) * 100;

      if (usagePercent > 90) {
        return {
          status: 'fail',
          message: `High memory usage: ${usagePercent.toFixed(1)}%`,
        };
      } else if (usagePercent > 75) {
        return {
          status: 'warn',
          message: `Elevated memory usage: ${usagePercent.toFixed(1)}%`,
        };
      } else {
        return {
          status: 'pass',
          message: `Memory usage normal: ${usagePercent.toFixed(1)}%`,
        };
      }
    });

    // Disk space health check (basic)
    this.monitoringService.registerHealthCheck('disk', async () => {
      try {
        // This is a basic check - in production you might want to use a library
        // to check actual disk usage
        return { status: 'pass', message: 'Disk space check not implemented' };
      } catch (error) {
        return { status: 'fail', message: 'Disk space check failed' };
      }
    });
  }

  // GET /metrics - Prometheus-style metrics
  async getMetrics(req: Request, res: Response): Promise<void> {
    try {
      const format = req.query.format as string;

      if (format === 'prometheus') {
        const prometheusMetrics = this.monitoringService.exportPrometheusMetrics();
        res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
        res.send(prometheusMetrics);
      } else {
        const metrics = this.monitoringService.getAllMetrics();
        res.json({
          success: true,
          data: metrics,
        });
      }
    } catch (error) {
      logger.error('Error getting metrics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve metrics',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // GET /health - Health check endpoint
  async getHealth(req: Request, res: Response): Promise<void> {
    try {
      const healthStatus = await this.monitoringService.getHealthStatus();

      // Set appropriate HTTP status based on health
      const statusCode = healthStatus.status === 'healthy' ? 200 : healthStatus.status === 'degraded' ? 200 : 503;

      res.status(statusCode).json({
        success: healthStatus.status !== 'unhealthy',
        data: healthStatus,
      });
    } catch (error) {
      logger.error('Error getting health status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve health status',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // GET /health/live - Kubernetes liveness probe
  async getLiveness(req: Request, res: Response): Promise<void> {
    // Simple liveness check - service is alive if it can respond
    res.status(200).json({
      status: 'alive',
      timestamp: new Date().toISOString(),
    });
  }

  // GET /health/ready - Kubernetes readiness probe
  async getReadiness(req: Request, res: Response): Promise<void> {
    try {
      const healthStatus = await this.monitoringService.getHealthStatus();

      // Service is ready if it's healthy or degraded (but not unhealthy)
      const isReady = healthStatus.status !== 'unhealthy';

      res.status(isReady ? 200 : 503).json({
        status: isReady ? 'ready' : 'not_ready',
        health: healthStatus.status,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error checking readiness:', error);
      res.status(503).json({
        status: 'not_ready',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  }

  // GET /stats - General service statistics
  async getStats(req: Request, res: Response): Promise<void> {
    try {
      const metrics = this.monitoringService.getAllMetrics();

      // Create a simplified stats view
      const stats = {
        uptime: metrics.system.uptime,
        requests: {
          total: metrics.counters.http_requests_total || 0,
          success: metrics.counters.http_requests_success || 0,
          errors: metrics.counters.http_requests_error || 0,
          successRate:
            metrics.counters.http_requests_total > 0
              ? (((metrics.counters.http_requests_success || 0) / metrics.counters.http_requests_total) * 100).toFixed(
                  2
                ) + '%'
              : '0%',
        },
        notifications: {
          sent: metrics.counters.notifications_sent || 0,
          failed: metrics.counters.notifications_failed || 0,
          emails: metrics.counters.email_sent || 0,
          emailsFailed: metrics.counters.email_failed || 0,
        },
        messaging: {
          processed: metrics.counters.messages_processed || 0,
          failed: metrics.counters.messages_failed || 0,
          retried: metrics.counters.messages_retried || 0,
          deadLetter: metrics.counters.messages_dead_letter || 0,
        },
        queues: {
          main: metrics.gauges.queue_size || 0,
          retry: metrics.gauges.retry_queue_size || 0,
          deadLetter: metrics.gauges.dead_letter_queue_size || 0,
        },
        system: {
          memory: metrics.system.memory,
          activeConnections: metrics.gauges.active_connections || 0,
        },
        timestamp: new Date().toISOString(),
      };

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('Error getting stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve stats',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // POST /health/check/:component - Manual health check for specific component
  async checkComponent(req: Request, res: Response): Promise<void> {
    try {
      const component = req.params.component;
      const healthStatus = await this.monitoringService.getHealthStatus();

      if (!healthStatus.checks[component]) {
        res.status(404).json({
          success: false,
          message: `Health check component '${component}' not found`,
          availableComponents: Object.keys(healthStatus.checks),
        });
        return;
      }

      const componentStatus = healthStatus.checks[component];
      const statusCode = componentStatus.status === 'pass' ? 200 : componentStatus.status === 'warn' ? 200 : 503;

      res.status(statusCode).json({
        success: componentStatus.status !== 'fail',
        data: {
          component,
          ...componentStatus,
        },
      });
    } catch (error) {
      logger.error('Error checking component health:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to check component health',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

export default MonitoringController;
