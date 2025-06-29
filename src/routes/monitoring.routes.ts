import { Router } from 'express';
import MonitoringController from '../controllers/monitoring.controller';
import AuthMiddleware from '../middlewares/auth.middleware';

const router = Router();
const monitoringController = new MonitoringController();

/**
 * @route GET /api/monitoring
 * @desc Get available monitoring endpoints
 * @access Public
 */
router.get('/', (req, res) => {
  res.json({
    message: '🔍 Monitoring API',
    endpoints: {
      health: '/api/monitoring/health',
      liveness: '/api/monitoring/health/live',
      readiness: '/api/monitoring/health/ready',
      metrics: '/api/monitoring/metrics',
      stats: '/api/monitoring/stats',
      checkComponent: '/api/monitoring/health/check/:component',
    },
  });
});

/**
 * @route GET /api/monitoring/metrics
 * @desc Get service metrics (Prometheus format available with ?format=prometheus)
 * @access Protected - requires authentication
 */
router.get(
  '/metrics',
  AuthMiddleware.protect,
  AuthMiddleware.admin,
  monitoringController.getMetrics.bind(monitoringController)
);

/**
 * @route GET /api/monitoring/health
 * @desc Get comprehensive health status
 * @access Public
 */
router.get('/health', monitoringController.getHealth.bind(monitoringController));

/**
 * @route GET /api/monitoring/health/live
 * @desc Kubernetes liveness probe endpoint
 * @access Public
 */
router.get('/health/live', monitoringController.getLiveness.bind(monitoringController));

/**
 * @route GET /api/monitoring/health/ready
 * @desc Kubernetes readiness probe endpoint
 * @access Public
 */
router.get('/health/ready', monitoringController.getReadiness.bind(monitoringController));

/**
 * @route GET /api/monitoring/stats
 * @desc Get simplified service statistics
 * @access Protected - requires authentication
 */
router.get(
  '/stats',
  AuthMiddleware.protect,
  AuthMiddleware.admin,
  monitoringController.getStats.bind(monitoringController)
);

/**
 * @route POST /api/monitoring/health/check/:component
 * @desc Manual health check for specific component
 * @access Protected - requires authentication
 */
router.post(
  '/health/check/:component',
  AuthMiddleware.protect,
  AuthMiddleware.admin,
  monitoringController.checkComponent.bind(monitoringController)
);

export default router;
