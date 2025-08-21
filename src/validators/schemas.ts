import { z } from 'zod';
import { EventTypes } from '../events/event-types.js';

// Base schemas for common fields
export const emailSchema = z.string().email('Invalid email format');
export const phoneSchema = z
  .string()
  .regex(/^\+?[\d\s\-\(\)]+$/, 'Invalid phone number format')
  .optional();
export const uuidSchema = z.string().uuid('Invalid UUID format');

// Common parameter schemas
export const notificationIdSchema = z.object({
  notificationId: z.string().uuid('Invalid notification ID format'),
});

export const userIdSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
});

export const templateIdSchema = z.object({
  id: z.string().uuid('Invalid template ID format'),
});

// Event type validation
export const eventTypeSchema = z.nativeEnum(EventTypes, {
  errorMap: () => ({ message: 'Invalid event type' }),
});

// Channel validation
export const channelSchema = z.enum(['email', 'sms', 'push', 'webhook'], {
  errorMap: () => ({ message: 'Invalid channel type' }),
});

// Template route parameters schema
export const templateParamsSchema = z.object({
  eventType: z.string().min(1, 'Event type is required'),
  channel: z.enum(['email', 'sms', 'push', 'webhook']),
});

// Notification creation schema
export const createNotificationSchema = z.object({
  eventType: eventTypeSchema,
  userId: z.string().min(1, 'User ID is required'),
  userEmail: emailSchema.optional(),
  userPhone: phoneSchema,
  channel: channelSchema.optional().default('email'),
  data: z.record(z.any()).optional(), // Flexible object for event-specific data
});

// Template creation schema
export const createTemplateSchema = z.object({
  event_type: z.string().min(1, 'Event type is required'),
  channel: channelSchema,
  template_name: z.string().min(1, 'Template name is required'),
  subject: z.string().optional(),
  message_template: z.string().min(1, 'Message template is required'),
  is_active: z.boolean().default(true),
});

// Template update schema
export const updateTemplateSchema = createTemplateSchema.partial();

// Template rendering test schema
export const renderTemplateTestSchema = z.object({
  eventType: z.string().min(1, 'Event type is required'),
  channel: channelSchema,
  variables: z
    .record(z.any())
    .refine((val) => typeof val === 'object' && val !== null, { message: 'Variables must be an object' }),
});

// Query parameter schemas
export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const notificationFiltersSchema = paginationSchema.extend({
  status: z.enum(['pending', 'sent', 'failed', 'retry']).optional(),
  eventType: z.string().optional(),
});

// Email test schema
export const emailTestSchema = z.object({
  to: emailSchema,
  subject: z.string().min(1, 'Subject is required').optional(),
  message: z.string().min(1, 'Message is required').optional(),
});

// Export types for use in controllers
export type CreateNotificationInput = z.infer<typeof createNotificationSchema>;
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;
export type RenderTemplateTestInput = z.infer<typeof renderTemplateTestSchema>;
export type NotificationFiltersInput = z.infer<typeof notificationFiltersSchema>;
export type EmailTestInput = z.infer<typeof emailTestSchema>;

// Parameter validation types
export type NotificationIdParams = z.infer<typeof notificationIdSchema>;
export type UserIdParams = z.infer<typeof userIdSchema>;
export type TemplateIdParams = z.infer<typeof templateIdSchema>;
export type TemplateParamsType = z.infer<typeof templateParamsSchema>;
