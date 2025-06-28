import { Request, Response } from 'express';
import { EventTypes } from '../events/event-types';
import logger from '../utils/logger';

export function sendNotification(req: Request, res: Response): void {
  logger.info('Send notification endpoint accessed (TESTING ONLY)');

  const { eventType, userId, data } = req.body;

  // Basic validation
  if (!eventType || !userId) {
    res.status(400).json({
      success: false,
      message: 'eventType and userId are required',
    });
    return;
  }

  // Validate event type
  if (!Object.values(EventTypes).includes(eventType)) {
    res.status(400).json({
      success: false,
      message: 'Invalid event type',
      validEventTypes: Object.values(EventTypes),
    });
    return;
  }

  // For testing only - simulate manual event injection
  logger.warn('⚠️ TESTING: Manual notification triggered via API (not recommended for production)');
  logger.info('Processing test notification:', {
    eventType,
    userId,
    data,
    timestamp: new Date().toISOString(),
  });

  // Simulate notification processing
  const notificationId = `test_notif_${Date.now()}`;

  res.status(201).json({
    success: true,
    message: 'Test notification processed (API testing only)',
    notificationId,
    eventType,
    userId,
    status: 'processed',
    timestamp: new Date().toISOString(),
    note: 'This endpoint is for testing only. Production notifications should come from message broker events.',
  });
}

export function getNotifications(req: Request, res: Response): void {
  logger.info('Get notifications endpoint accessed');

  // For now, return a simple response (we'll add database queries later)
  res.json({
    success: true,
    message: 'Notifications endpoint - coming soon',
    notifications: [],
  });
}
