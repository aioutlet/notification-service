import express from 'express';
import {
  sendNotification,
  getNotifications,
  getUserNotifications,
  getNotificationById,
  getNotificationStats,
  testEmailService,
} from '../controllers/notification.controller.js';
import { validateBody, validateQuery, validateParams } from '../middlewares/validation.middleware.js';
import {
  createNotificationSchema,
  notificationFiltersSchema,
  emailTestSchema,
  notificationIdSchema,
  userIdSchema,
} from '../shared/validators/schemas.js';
import AuthMiddleware from '../middlewares/auth.middleware.js';

const router = express.Router();

// POST /api/notifications/send - Create test notification (development only)
// Protected: Only authenticated users can send test notifications
router.post('/send', AuthMiddleware.protect, validateBody(createNotificationSchema), sendNotification);

// POST /api/notifications - Create test notification (backward compatibility)
// Protected: Only authenticated users can create notifications
router.post('/', AuthMiddleware.protect, validateBody(createNotificationSchema), sendNotification);

// GET /api/notifications - Get all notifications with optional filters
// Protected: Only admin can view all notifications
router.get(
  '/',
  AuthMiddleware.protect,
  AuthMiddleware.admin,
  validateQuery(notificationFiltersSchema),
  getNotifications
);

// GET /api/notifications/stats - Get notification statistics
// Protected: Only admin can view statistics
router.get('/stats', AuthMiddleware.protect, AuthMiddleware.admin, getNotificationStats);

// GET /api/notifications/:notificationId - Get a specific notification
// Protected: Authenticated users can view specific notifications
router.get('/:notificationId', AuthMiddleware.protect, validateParams(notificationIdSchema), getNotificationById);

// GET /api/notifications/users/:userId - Get notifications for a user
// Protected: Users can access their own data, admins can access any user data
router.get(
  '/users/:userId',
  AuthMiddleware.protect,
  validateParams(userIdSchema),
  validateQuery(notificationFiltersSchema),
  getUserNotifications
);

// POST /api/notifications/test/email - Test email service (for development)
// Protected: Only authenticated users can test email service
router.post('/test/email', AuthMiddleware.protect, validateBody(emailTestSchema), testEmailService);

export default router;
