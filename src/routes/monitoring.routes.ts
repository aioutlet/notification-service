import { Router } from 'express';
import MonitoringController from '../controllers/monitoring.controller';
import AuthMiddleware from '../middlewares/auth.middleware';

const router = Router();
const monitoringController = new MonitoringController();

/**
 * @route GET /metrics
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
 * @route GET /health
 * @desc Get comprehensive health status
 * @access Public
 */
router.get('/health', monitoringController.getHealth.bind(monitoringController));

/**
 * @route GET /health/live
 * @desc Kubernetes liveness probe endpoint
 * @access Public
 */
router.get('/health/live', monitoringController.getLiveness.bind(monitoringController));

/**
 * @route GET /health/ready
 * @desc Kubernetes readiness probe endpoint
 * @access Public
 */
router.get('/health/ready', monitoringController.getReadiness.bind(monitoringController));

/**
 * @route GET /stats
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
 * @route POST /health/check/:component
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
