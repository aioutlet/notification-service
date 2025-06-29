import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

interface MetricCounter {
  [key: string]: number;
}

interface MetricHistogram {
  [key: string]: number[];
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    [key: string]: {
      status: 'pass' | 'fail' | 'warn';
      message?: string;
      lastChecked: string;
      responseTime?: number;
    };
  };
  uptime: number;
  timestamp: string;
}

class MonitoringService {
  private static instance: MonitoringService;
  private metrics: {
    counters: MetricCounter;
    histograms: MetricHistogram;
    gauges: MetricCounter;
  };
  private healthChecks: Map<
    string,
    () => Promise<{ status: 'pass' | 'fail' | 'warn'; message?: string; responseTime?: number }>
  >;
  private startTime: number;

  private constructor() {
    this.metrics = {
      counters: {},
      histograms: {},
      gauges: {},
    };
    this.healthChecks = new Map();
    this.startTime = Date.now();
    this.initializeDefaultMetrics();
  }

  static getInstance(): MonitoringService {
    if (!MonitoringService.instance) {
      MonitoringService.instance = new MonitoringService();
    }
    return MonitoringService.instance;
  }

  private initializeDefaultMetrics(): void {
    // Initialize default counters
    this.metrics.counters = {
      http_requests_total: 0,
      http_requests_success: 0,
      http_requests_error: 0,
      notifications_sent: 0,
      notifications_failed: 0,
      email_sent: 0,
      email_failed: 0,
      messages_processed: 0,
      messages_failed: 0,
      messages_retried: 0,
      messages_dead_letter: 0,
    };

    // Initialize default histograms
    this.metrics.histograms = {
      http_request_duration: [],
      notification_processing_duration: [],
      email_send_duration: [],
      database_query_duration: [],
    };

    // Initialize default gauges
    this.metrics.gauges = {
      active_connections: 0,
      queue_size: 0,
      retry_queue_size: 0,
      dead_letter_queue_size: 0,
      memory_usage_mb: 0,
      cpu_usage_percent: 0,
    };
  }

  // Counter methods
  incrementCounter(name: string, value: number = 1): void {
    if (!this.metrics.counters[name]) {
      this.metrics.counters[name] = 0;
    }
    this.metrics.counters[name] += value;
  }

  getCounter(name: string): number {
    return this.metrics.counters[name] || 0;
  }

  // Histogram methods
  recordHistogram(name: string, value: number): void {
    if (!this.metrics.histograms[name]) {
      this.metrics.histograms[name] = [];
    }
    this.metrics.histograms[name].push(value);

    // Keep only last 1000 values to prevent memory leaks
    if (this.metrics.histograms[name].length > 1000) {
      this.metrics.histograms[name] = this.metrics.histograms[name].slice(-1000);
    }
  }

  getHistogramStats(
    name: string
  ): { count: number; avg: number; min: number; max: number; p95: number; p99: number } | null {
    const values = this.metrics.histograms[name];
    if (!values || values.length === 0) {
      return null;
    }

    const sorted = [...values].sort((a, b) => a - b);
    const count = sorted.length;
    const sum = sorted.reduce((a, b) => a + b, 0);
    const avg = sum / count;
    const min = sorted[0];
    const max = sorted[count - 1];
    const p95Index = Math.floor(count * 0.95);
    const p99Index = Math.floor(count * 0.99);
    const p95 = sorted[p95Index] || max;
    const p99 = sorted[p99Index] || max;

    return { count, avg, min, max, p95, p99 };
  }

  // Gauge methods
  setGauge(name: string, value: number): void {
    this.metrics.gauges[name] = value;
  }

  getGauge(name: string): number {
    return this.metrics.gauges[name] || 0;
  }

  // Health check methods
  registerHealthCheck(
    name: string,
    checkFunction: () => Promise<{ status: 'pass' | 'fail' | 'warn'; message?: string; responseTime?: number }>
  ): void {
    this.healthChecks.set(name, checkFunction);
  }

  async getHealthStatus(): Promise<HealthStatus> {
    const checks: HealthStatus['checks'] = {};
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    for (const [name, checkFunction] of this.healthChecks) {
      try {
        const startTime = Date.now();
        const result = await checkFunction();
        const responseTime = Date.now() - startTime;

        checks[name] = {
          ...result,
          lastChecked: new Date().toISOString(),
          responseTime,
        };

        if (result.status === 'fail') {
          overallStatus = 'unhealthy';
        } else if (result.status === 'warn' && overallStatus === 'healthy') {
          overallStatus = 'degraded';
        }
      } catch (error) {
        checks[name] = {
          status: 'fail',
          message: error instanceof Error ? error.message : 'Unknown error',
          lastChecked: new Date().toISOString(),
        };
        overallStatus = 'unhealthy';
      }
    }

    return {
      status: overallStatus,
      checks,
      uptime: (Date.now() - this.startTime) / 1000,
      timestamp: new Date().toISOString(),
    };
  }

  // Get all metrics
  getAllMetrics(): any {
    const histogramStats: any = {};
    for (const [name, values] of Object.entries(this.metrics.histograms)) {
      histogramStats[name] = this.getHistogramStats(name);
    }

    // Get system metrics
    const memUsage = process.memoryUsage();
    this.setGauge('memory_usage_mb', Math.round(memUsage.heapUsed / 1024 / 1024));

    return {
      counters: this.metrics.counters,
      histograms: histogramStats,
      gauges: this.metrics.gauges,
      system: {
        uptime: (Date.now() - this.startTime) / 1000,
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        memory: {
          rss: Math.round(memUsage.rss / 1024 / 1024),
          heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
          external: Math.round(memUsage.external / 1024 / 1024),
        },
      },
      timestamp: new Date().toISOString(),
    };
  }

  // Middleware for HTTP request metrics
  httpMetricsMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();

      // Track active connections
      this.setGauge('active_connections', this.getGauge('active_connections') + 1);

      res.on('finish', () => {
        const duration = Date.now() - startTime;

        // Record metrics
        this.incrementCounter('http_requests_total');
        this.recordHistogram('http_request_duration', duration);

        if (res.statusCode >= 200 && res.statusCode < 400) {
          this.incrementCounter('http_requests_success');
        } else {
          this.incrementCounter('http_requests_error');
        }

        // Update active connections
        this.setGauge('active_connections', Math.max(0, this.getGauge('active_connections') - 1));
      });

      next();
    };
  }

  // Method to record notification metrics
  recordNotificationSent(channel: string, duration: number): void {
    this.incrementCounter('notifications_sent');
    this.incrementCounter(`notifications_sent_${channel}`);
    this.recordHistogram('notification_processing_duration', duration);
  }

  recordNotificationFailed(channel: string, reason: string): void {
    this.incrementCounter('notifications_failed');
    this.incrementCounter(`notifications_failed_${channel}`);
    this.incrementCounter(`notification_failure_${reason.replace(/[^a-zA-Z0-9]/g, '_')}`);
  }

  recordEmailSent(duration: number): void {
    this.incrementCounter('email_sent');
    this.recordHistogram('email_send_duration', duration);
  }

  recordEmailFailed(): void {
    this.incrementCounter('email_failed');
  }

  recordMessageProcessed(duration: number): void {
    this.incrementCounter('messages_processed');
    this.recordHistogram('message_processing_duration', duration);
  }

  recordMessageFailed(): void {
    this.incrementCounter('messages_failed');
  }

  recordMessageRetried(): void {
    this.incrementCounter('messages_retried');
  }

  recordMessageDeadLetter(): void {
    this.incrementCounter('messages_dead_letter');
  }

  recordDatabaseQuery(operation: string, duration: number): void {
    this.recordHistogram('database_query_duration', duration);
    this.recordHistogram(`database_${operation}_duration`, duration);
  }

  // Update queue sizes (called periodically or from queue monitoring)
  updateQueueSizes(main: number, retry: number, dlq: number): void {
    this.setGauge('queue_size', main);
    this.setGauge('retry_queue_size', retry);
    this.setGauge('dead_letter_queue_size', dlq);
  }

  // Export metrics in Prometheus format (basic implementation)
  exportPrometheusMetrics(): string {
    let output = '';

    // Export counters
    for (const [name, value] of Object.entries(this.metrics.counters)) {
      output += `# TYPE ${name} counter\n`;
      output += `${name} ${value}\n`;
    }

    // Export gauges
    for (const [name, value] of Object.entries(this.metrics.gauges)) {
      output += `# TYPE ${name} gauge\n`;
      output += `${name} ${value}\n`;
    }

    // Export histogram summaries
    for (const [name, values] of Object.entries(this.metrics.histograms)) {
      if (values.length > 0) {
        const stats = this.getHistogramStats(name);
        if (stats) {
          output += `# TYPE ${name} histogram\n`;
          output += `${name}_count ${stats.count}\n`;
          output += `${name}_avg ${stats.avg.toFixed(2)}\n`;
          output += `${name}_min ${stats.min}\n`;
          output += `${name}_max ${stats.max}\n`;
          output += `${name}_p95 ${stats.p95}\n`;
          output += `${name}_p99 ${stats.p99}\n`;
        }
      }
    }

    return output;
  }
}

export default MonitoringService;
