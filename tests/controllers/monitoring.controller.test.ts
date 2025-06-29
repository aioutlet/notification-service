import { Request, Response } from 'express';

// Mock dependencies
jest.mock('../../src/utils/logger');

// Mock the services before importing the controller
const mockMonitoringService = {
  getInstance: jest.fn(),
  getAllMetrics: jest.fn(),
  exportPrometheusMetrics: jest.fn(),
  getHealthStatus: jest.fn(),
  registerHealthCheck: jest.fn(),
};

const mockDatabaseService = {
  getInstance: jest.fn(),
  testConnection: jest.fn(),
};

const mockEmailService = {
  isEnabled: jest.fn(),
};

jest.mock('../../src/services/monitoring.service', () => ({
  __esModule: true,
  default: {
    getInstance: jest.fn(() => mockMonitoringService),
  },
}));

jest.mock('../../src/services/database.service', () => ({
  __esModule: true,
  default: {
    getInstance: jest.fn(() => mockDatabaseService),
  },
}));

jest.mock('../../src/services/email.service', () => {
  return jest.fn().mockImplementation(() => mockEmailService);
});

// Import after mocking
import MonitoringController from '../../src/controllers/monitoring.controller';
import logger from '../../src/utils/logger';

describe('Monitoring Controller', () => {
  let controller: MonitoringController;

  // Create mock response object
  const mockResponse = () => {
    const res = {} as Response;
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    res.set = jest.fn().mockReturnValue(res);
    return res;
  };

  // Create mock request object
  const mockRequest = (overrides: Partial<Request> = {}) => {
    const req = {
      query: {},
      params: {},
      ...overrides,
    } as Request;
    return req;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset all mock functions
    mockMonitoringService.getAllMetrics.mockReset();
    mockMonitoringService.exportPrometheusMetrics.mockReset();
    mockMonitoringService.getHealthStatus.mockReset();
    mockMonitoringService.registerHealthCheck.mockReset();
    mockDatabaseService.testConnection.mockReset();
    mockEmailService.isEnabled.mockReset();

    // Create a new controller instance for each test
    controller = new MonitoringController();
  });

  describe('getMetrics', () => {
    it('should return JSON metrics by default', async () => {
      const req = mockRequest({
        query: {},
      });
      const res = mockResponse();

      const mockMetrics = {
        counters: {
          http_requests_total: 100,
          notifications_sent: 50,
        },
        gauges: {
          active_connections: 5,
          queue_size: 10,
        },
        histograms: {
          request_duration: [100, 200, 150],
        },
        system: {
          uptime: 3600,
          memory: {
            heapUsed: 50 * 1024 * 1024,
            heapTotal: 100 * 1024 * 1024,
          },
        },
      };

      mockMonitoringService.getAllMetrics.mockReturnValue(mockMetrics);

      await controller.getMetrics(req, res);

      expect(mockMonitoringService.getAllMetrics).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockMetrics,
      });
    });

    it('should return Prometheus format when format=prometheus', async () => {
      const req = mockRequest({
        query: { format: 'prometheus' },
      });
      const res = mockResponse();

      const prometheusMetrics = `# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total 100

# HELP notifications_sent Total notifications sent
# TYPE notifications_sent counter
notifications_sent 50`;

      mockMonitoringService.exportPrometheusMetrics.mockReturnValue(prometheusMetrics);

      await controller.getMetrics(req, res);

      expect(mockMonitoringService.exportPrometheusMetrics).toHaveBeenCalled();
      expect(res.set).toHaveBeenCalledWith('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
      expect(res.send).toHaveBeenCalledWith(prometheusMetrics);
    });

    it('should handle service errors', async () => {
      const req = mockRequest();
      const res = mockResponse();

      const mockError = new Error('Metrics service error');
      mockMonitoringService.getAllMetrics.mockImplementation(() => {
        throw mockError;
      });

      await controller.getMetrics(req, res);

      expect(logger.error).toHaveBeenCalledWith('Error getting metrics:', mockError);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to retrieve metrics',
        error: 'Metrics service error',
      });
    });
  });

  describe('getHealth', () => {
    it('should return healthy status with 200 status code', async () => {
      const req = mockRequest();
      const res = mockResponse();

      const mockHealthStatus = {
        status: 'healthy' as const,
        checks: {
          database: {
            status: 'pass' as const,
            message: 'Database connection healthy',
            lastChecked: '2024-01-01T00:00:00Z',
          },
          email: {
            status: 'pass' as const,
            message: 'Email service configured and enabled',
            lastChecked: '2024-01-01T00:00:00Z',
          },
        },
        uptime: 3600,
        timestamp: '2024-01-01T00:00:00Z',
      };

      mockMonitoringService.getHealthStatus.mockResolvedValue(mockHealthStatus);

      await controller.getHealth(req, res);

      expect(mockMonitoringService.getHealthStatus).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockHealthStatus,
      });
    });

    it('should return degraded status with 200 status code', async () => {
      const req = mockRequest();
      const res = mockResponse();

      const mockHealthStatus = {
        status: 'degraded' as const,
        checks: {
          database: {
            status: 'pass' as const,
            message: 'Database connection healthy',
            lastChecked: '2024-01-01T00:00:00Z',
          },
          email: {
            status: 'warn' as const,
            message: 'Email service is disabled',
            lastChecked: '2024-01-01T00:00:00Z',
          },
        },
        uptime: 3600,
        timestamp: '2024-01-01T00:00:00Z',
      };

      mockMonitoringService.getHealthStatus.mockResolvedValue(mockHealthStatus);

      await controller.getHealth(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockHealthStatus,
      });
    });

    it('should return unhealthy status with 503 status code', async () => {
      const req = mockRequest();
      const res = mockResponse();

      const mockHealthStatus = {
        status: 'unhealthy' as const,
        checks: {
          database: {
            status: 'fail' as const,
            message: 'Database connection failed',
            lastChecked: '2024-01-01T00:00:00Z',
          },
        },
        uptime: 3600,
        timestamp: '2024-01-01T00:00:00Z',
      };

      mockMonitoringService.getHealthStatus.mockResolvedValue(mockHealthStatus);

      await controller.getHealth(req, res);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        data: mockHealthStatus,
      });
    });

    it('should handle service errors', async () => {
      const req = mockRequest();
      const res = mockResponse();

      const mockError = new Error('Health check error');
      mockMonitoringService.getHealthStatus.mockRejectedValue(mockError);

      await controller.getHealth(req, res);

      expect(logger.error).toHaveBeenCalledWith('Error getting health status:', mockError);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to retrieve health status',
        error: 'Health check error',
      });
    });
  });

  describe('getLiveness', () => {
    it('should always return alive status with 200', async () => {
      const req = mockRequest();
      const res = mockResponse();

      await controller.getLiveness(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: 'alive',
        timestamp: expect.any(String),
      });
    });
  });

  describe('getReadiness', () => {
    it('should return ready status when health is healthy', async () => {
      const req = mockRequest();
      const res = mockResponse();

      const mockHealthStatus = {
        status: 'healthy' as const,
        checks: {},
        uptime: 3600,
        timestamp: '2024-01-01T00:00:00Z',
      };

      mockMonitoringService.getHealthStatus.mockResolvedValue(mockHealthStatus);

      await controller.getReadiness(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: 'ready',
        health: 'healthy',
        timestamp: expect.any(String),
      });
    });

    it('should return ready status when health is degraded', async () => {
      const req = mockRequest();
      const res = mockResponse();

      const mockHealthStatus = {
        status: 'degraded' as const,
        checks: {},
        uptime: 3600,
        timestamp: '2024-01-01T00:00:00Z',
      };

      mockMonitoringService.getHealthStatus.mockResolvedValue(mockHealthStatus);

      await controller.getReadiness(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: 'ready',
        health: 'degraded',
        timestamp: expect.any(String),
      });
    });

    it('should return not ready status when health is unhealthy', async () => {
      const req = mockRequest();
      const res = mockResponse();

      const mockHealthStatus = {
        status: 'unhealthy' as const,
        checks: {},
        uptime: 3600,
        timestamp: '2024-01-01T00:00:00Z',
      };

      mockMonitoringService.getHealthStatus.mockResolvedValue(mockHealthStatus);

      await controller.getReadiness(req, res);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith({
        status: 'not_ready',
        health: 'unhealthy',
        timestamp: expect.any(String),
      });
    });

    it('should handle service errors', async () => {
      const req = mockRequest();
      const res = mockResponse();

      const mockError = new Error('Readiness check error');
      mockMonitoringService.getHealthStatus.mockRejectedValue(mockError);

      await controller.getReadiness(req, res);

      expect(logger.error).toHaveBeenCalledWith('Error checking readiness:', mockError);
      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith({
        status: 'not_ready',
        error: 'Readiness check error',
        timestamp: expect.any(String),
      });
    });
  });

  describe('getStats', () => {
    it('should return formatted statistics', async () => {
      const req = mockRequest();
      const res = mockResponse();

      const mockMetrics = {
        system: {
          uptime: 3600,
          memory: {
            heapUsed: 50 * 1024 * 1024,
            heapTotal: 100 * 1024 * 1024,
          },
        },
        counters: {
          http_requests_total: 100,
          http_requests_success: 95,
          http_requests_error: 5,
          notifications_sent: 50,
          notifications_failed: 2,
          email_sent: 45,
          email_failed: 1,
          messages_processed: 80,
          messages_failed: 3,
          messages_retried: 2,
          messages_dead_letter: 1,
        },
        gauges: {
          queue_size: 10,
          retry_queue_size: 2,
          dead_letter_queue_size: 1,
          active_connections: 5,
        },
      };

      mockMonitoringService.getAllMetrics.mockReturnValue(mockMetrics);

      await controller.getStats(req, res);

      expect(mockMonitoringService.getAllMetrics).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          uptime: 3600,
          requests: {
            total: 100,
            success: 95,
            errors: 5,
            successRate: '95.00%',
          },
          notifications: {
            sent: 50,
            failed: 2,
            emails: 45,
            emailsFailed: 1,
          },
          messaging: {
            processed: 80,
            failed: 3,
            retried: 2,
            deadLetter: 1,
          },
          queues: {
            main: 10,
            retry: 2,
            deadLetter: 1,
          },
          system: {
            memory: mockMetrics.system.memory,
            activeConnections: 5,
          },
          timestamp: expect.any(String),
        },
      });
    });

    it('should handle zero requests for success rate calculation', async () => {
      const req = mockRequest();
      const res = mockResponse();

      const mockMetrics = {
        system: { uptime: 3600, memory: {} },
        counters: {
          http_requests_total: 0,
        },
        gauges: {},
      };

      mockMonitoringService.getAllMetrics.mockReturnValue(mockMetrics);

      await controller.getStats(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            requests: expect.objectContaining({
              successRate: '0%',
            }),
          }),
        })
      );
    });

    it('should handle missing metrics gracefully', async () => {
      const req = mockRequest();
      const res = mockResponse();

      const mockMetrics = {
        system: { uptime: 3600, memory: {} },
        counters: {},
        gauges: {},
      };

      mockMonitoringService.getAllMetrics.mockReturnValue(mockMetrics);

      await controller.getStats(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          uptime: 3600,
          requests: {
            total: 0,
            success: 0,
            errors: 0,
            successRate: '0%',
          },
          notifications: {
            sent: 0,
            failed: 0,
            emails: 0,
            emailsFailed: 0,
          },
          messaging: {
            processed: 0,
            failed: 0,
            retried: 0,
            deadLetter: 0,
          },
          queues: {
            main: 0,
            retry: 0,
            deadLetter: 0,
          },
          system: {
            memory: {},
            activeConnections: 0,
          },
          timestamp: expect.any(String),
        },
      });
    });

    it('should handle service errors', async () => {
      const req = mockRequest();
      const res = mockResponse();

      const mockError = new Error('Stats service error');
      mockMonitoringService.getAllMetrics.mockImplementation(() => {
        throw mockError;
      });

      await controller.getStats(req, res);

      expect(logger.error).toHaveBeenCalledWith('Error getting stats:', mockError);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to retrieve stats',
        error: 'Stats service error',
      });
    });
  });

  describe('checkComponent', () => {
    it('should return component health when component exists and is passing', async () => {
      const req = mockRequest({
        params: { component: 'database' },
      });
      const res = mockResponse();

      const mockHealthStatus = {
        status: 'healthy' as const,
        checks: {
          database: {
            status: 'pass' as const,
            message: 'Database connection healthy',
            lastChecked: '2024-01-01T00:00:00Z',
            responseTime: 50,
          },
          email: {
            status: 'pass' as const,
            message: 'Email service enabled',
            lastChecked: '2024-01-01T00:00:00Z',
          },
        },
        uptime: 3600,
        timestamp: '2024-01-01T00:00:00Z',
      };

      mockMonitoringService.getHealthStatus.mockResolvedValue(mockHealthStatus);

      await controller.checkComponent(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          component: 'database',
          status: 'pass',
          message: 'Database connection healthy',
          lastChecked: '2024-01-01T00:00:00Z',
          responseTime: 50,
        },
      });
    });

    it('should return component health when component exists and is warning', async () => {
      const req = mockRequest({
        params: { component: 'email' },
      });
      const res = mockResponse();

      const mockHealthStatus = {
        status: 'degraded' as const,
        checks: {
          email: {
            status: 'warn' as const,
            message: 'Email service is disabled',
            lastChecked: '2024-01-01T00:00:00Z',
          },
        },
        uptime: 3600,
        timestamp: '2024-01-01T00:00:00Z',
      };

      mockMonitoringService.getHealthStatus.mockResolvedValue(mockHealthStatus);

      await controller.checkComponent(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          component: 'email',
          status: 'warn',
          message: 'Email service is disabled',
          lastChecked: '2024-01-01T00:00:00Z',
        },
      });
    });

    it('should return component health when component exists but is failing', async () => {
      const req = mockRequest({
        params: { component: 'database' },
      });
      const res = mockResponse();

      const mockHealthStatus = {
        status: 'unhealthy' as const,
        checks: {
          database: {
            status: 'fail' as const,
            message: 'Database connection failed',
            lastChecked: '2024-01-01T00:00:00Z',
          },
        },
        uptime: 3600,
        timestamp: '2024-01-01T00:00:00Z',
      };

      mockMonitoringService.getHealthStatus.mockResolvedValue(mockHealthStatus);

      await controller.checkComponent(req, res);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        data: {
          component: 'database',
          status: 'fail',
          message: 'Database connection failed',
          lastChecked: '2024-01-01T00:00:00Z',
        },
      });
    });

    it('should return 404 when component does not exist', async () => {
      const req = mockRequest({
        params: { component: 'nonexistent' },
      });
      const res = mockResponse();

      const mockHealthStatus = {
        status: 'healthy' as const,
        checks: {
          database: {
            status: 'pass' as const,
            message: 'Database connection healthy',
            lastChecked: '2024-01-01T00:00:00Z',
          },
          email: {
            status: 'pass' as const,
            message: 'Email service enabled',
            lastChecked: '2024-01-01T00:00:00Z',
          },
        },
        uptime: 3600,
        timestamp: '2024-01-01T00:00:00Z',
      };

      mockMonitoringService.getHealthStatus.mockResolvedValue(mockHealthStatus);

      await controller.checkComponent(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Health check component 'nonexistent' not found",
        availableComponents: ['database', 'email'],
      });
    });

    it('should handle service errors', async () => {
      const req = mockRequest({
        params: { component: 'database' },
      });
      const res = mockResponse();

      const mockError = new Error('Component check error');
      mockMonitoringService.getHealthStatus.mockRejectedValue(mockError);

      await controller.checkComponent(req, res);

      expect(logger.error).toHaveBeenCalledWith('Error checking component health:', mockError);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to check component health',
        error: 'Component check error',
      });
    });
  });
});
