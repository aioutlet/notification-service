import express from 'express';
import {
  sendNotification,
  getNotifications,
  getUserNotifications,
  getNotificationById,
  getNotificationStats,
} from '../controllers/notification.controller';

const router = express.Router();

router.post('/', sendNotification);
router.get('/', getNotifications);
router.get('/stats', getNotificationStats);
router.get('/:notificationId', getNotificationById);
router.get('/users/:userId', getUserNotifications);

export default router;
