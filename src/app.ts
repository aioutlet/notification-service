import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import homeRoutes from './routes/home.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import templateRoutes from './routes/template.routes.js';
import * as operationalController from './controllers/operational.controller.js';
import config from './config/index.js';
import {
  corsOptions,
  helmetConfig,
  compressionMiddleware,
  securityErrorHandler,
  sanitizeInput,
} from './middlewares/security.middleware.js';
import { globalErrorHandler, notFoundHandler } from './middlewares/error.middleware.js';
import { correlationIdMiddleware } from './middlewares/correlationId.middleware.js';
import { requestLoggingMiddleware, errorLoggingMiddleware } from './middlewares/request.middleware.js';

const app = express();

// Correlation ID middleware - must be first to ensure all requests have correlation ID
app.use(correlationIdMiddleware);

// Security middleware - must be applied first
app.use(helmetConfig); // Security headers
app.use(cors(corsOptions)); // CORS configuration
app.use(compressionMiddleware); // Response compression
app.use(cookieParser()); // Cookie parsing support

// HTTP metrics middleware - removed monitoring service dependency

// Request size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Input sanitization
app.use(sanitizeInput);

// Request logging
if (config.server.env !== 'test') {
  app.use(requestLoggingMiddleware);
}

// Routes
app.use('/api/home', homeRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/templates', templateRoutes);

// Operational endpoints for infrastructure/monitoring
app.get('/health', operationalController.health);
app.get('/health/ready', operationalController.readiness);
app.get('/health/live', operationalController.liveness);
app.get('/metrics', operationalController.metrics);

// 404 handler for unknown routes
app.use('*', notFoundHandler);

// Security error handler (keep before global error handler)
app.use(securityErrorHandler);

// Observability error handler
app.use(errorLoggingMiddleware);

// Global error handler (must be last)
app.use(globalErrorHandler);

export default app;
