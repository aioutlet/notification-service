import express from 'express';
import {
  sendNotification,
  getNotifications,
  getUserNotifications,
  getNotificationById,
  getNotificationStats,
  testEmailService,
} from '../controllers/notification.controller';
import { validateBody, validateQuery, validateParams } from '../middlewares/validation.middleware';
import { createNotificationSchema, notificationFiltersSchema, emailTestSchema } from '../validators/schemas';
import { z } from 'zod';

const router = express.Router();

// Validation schemas for params
const notificationIdSchema = z.object({
  notificationId: z.string().uuid('Invalid notification ID format'),
});

const userIdSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
});

// POST /api/notifications/send - Create test notification (development only)
router.post('/send', validateBody(createNotificationSchema), sendNotification);

// POST /api/notifications - Create test notification (backward compatibility)
router.post('/', validateBody(createNotificationSchema), sendNotification);

// GET /api/notifications - Get all notifications with optional filters
router.get('/', validateQuery(notificationFiltersSchema), getNotifications);

// GET /api/notifications/stats - Get notification statistics
router.get('/stats', getNotificationStats);

// GET /api/notifications/:notificationId - Get a specific notification
router.get('/:notificationId', validateParams(notificationIdSchema), getNotificationById);

// GET /api/notifications/users/:userId - Get notifications for a user
router.get(
  '/users/:userId',
  validateParams(userIdSchema),
  validateQuery(notificationFiltersSchema),
  getUserNotifications
);

// POST /api/notifications/test/email - Test email service (for development)
router.post('/test/email', validateBody(emailTestSchema), testEmailService);

export default router;
