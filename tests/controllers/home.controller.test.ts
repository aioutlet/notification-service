import { Request, Response } from 'express';
import { getWelcomeMessage, getVersion, health } from '../../src/api/controllers/home.controller';
import logger from '../../src/shared/observability/logging/index.js';

// Mock dependencies
jest.mock('../../src/shared/observability/logging/index.js');
jest.mock('../../src/shared/config/index', () => ({
  server: {
    env: 'test',
  },
}));

// Create mock response object
const mockResponse = () => {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

// Create mock request object
const mockRequest = () => {
  const req = {} as Request;
  return req;
};

describe('Home Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getWelcomeMessage', () => {
    it('should return welcome message with API information', () => {
      const req = mockRequest();
      const res = mockResponse();

      getWelcomeMessage(req, res);

      expect(logger.info).toHaveBeenCalledWith('Welcome endpoint accessed');
      expect(res.json).toHaveBeenCalledWith({
        message: '🔔 Notification Service API',
        version: '1.0.0',
        environment: 'test',
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
    });

    it('should use npm_package_version if available', () => {
      const req = mockRequest();
      const res = mockResponse();

      // Mock process.env.npm_package_version
      const originalVersion = process.env.npm_package_version;
      process.env.npm_package_version = '2.0.0';

      getWelcomeMessage(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          version: '2.0.0',
        })
      );

      // Restore original value
      process.env.npm_package_version = originalVersion;
    });
  });

  describe('getVersion', () => {
    it('should return version information', () => {
      const req = mockRequest();
      const res = mockResponse();

      getVersion(req, res);

      expect(logger.info).toHaveBeenCalledWith('Version endpoint accessed');
      expect(res.json).toHaveBeenCalledWith({
        name: 'notification-service',
        version: '1.0.0',
        environment: 'test',
        node: process.version,
      });
    });

    it('should use npm_package_version if available', () => {
      const req = mockRequest();
      const res = mockResponse();

      // Mock process.env.npm_package_version
      const originalVersion = process.env.npm_package_version;
      process.env.npm_package_version = '3.0.0';

      getVersion(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          version: '3.0.0',
        })
      );

      // Restore original value
      process.env.npm_package_version = originalVersion;
    });
  });

  describe('health', () => {
    it('should return health status with 200 status code', () => {
      const req = mockRequest();
      const res = mockResponse();

      // Mock Date.prototype.toISOString and process.uptime
      const mockTimestamp = '2025-06-29T10:00:00.000Z';
      const mockUptime = 123.456;

      jest.spyOn(Date.prototype, 'toISOString').mockReturnValue(mockTimestamp);
      jest.spyOn(process, 'uptime').mockReturnValue(mockUptime);

      health(req, res);

      expect(logger.info).toHaveBeenCalledWith('Health check endpoint accessed');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: 'healthy',
        timestamp: mockTimestamp,
        uptime: mockUptime,
        version: '1.0.0',
      });

      // Restore mocks
      jest.restoreAllMocks();
    });

    it('should use npm_package_version if available', () => {
      const req = mockRequest();
      const res = mockResponse();

      // Mock process.env.npm_package_version
      const originalVersion = process.env.npm_package_version;
      process.env.npm_package_version = '4.0.0';

      health(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          version: '4.0.0',
        })
      );

      // Restore original value
      process.env.npm_package_version = originalVersion;
    });

    it('should return current timestamp and uptime', () => {
      const req = mockRequest();
      const res = mockResponse();

      health(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'healthy',
          timestamp: expect.any(String),
          uptime: expect.any(Number),
        })
      );
    });
  });
});
