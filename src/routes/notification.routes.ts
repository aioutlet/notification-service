import express from 'express';
import { sendNotification, getNotifications } from '../controllers/notification.controller';

const router = express.Router();

// POST /api/notifications - Send a notification
router.post('/notifications', sendNotification);

// GET /api/notifications - Get notifications (for future use)
router.get('/notifications', getNotifications);

export default router;
