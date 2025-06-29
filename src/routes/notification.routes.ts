import express from 'express';
import {
  sendNotification,
  getNotifications,
  getUserNotifications,
  getNotificationById,
  getNotificationStats,
  testEmailService,
} from '../controllers/notification.controller';

const router = express.Router();

// POST /api/notifications/send - Create test notification (development only)
router.post('/send', sendNotification);

// GET /api/notifications - Get all notifications with optional filters
router.get('/', getNotifications);

// GET /api/notifications/stats - Get notification statistics
router.get('/stats', getNotificationStats);

// GET /api/notifications/:notificationId - Get a specific notification
router.get('/:notificationId', getNotificationById);

// GET /api/notifications/users/:userId - Get notifications for a user
router.get('/users/:userId', getUserNotifications);

// POST /api/notifications/test/email - Test email service (for development)
router.post('/test/email', testEmailService);

export default router;
