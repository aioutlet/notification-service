import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import homeRoutes from './routes/home.routes';
import notificationRoutes from './routes/notification.routes';
import templateRoutes from './routes/template.routes';
import * as operationalController from './controllers/operational.controller';
import logger from './utils/logger';
import config from './config/index';
import {
  rateLimiter,
  apiRateLimiter,
  speedLimiter,
  corsOptions,
  helmetConfig,
  compressionMiddleware,
  requestLogger,
  securityErrorHandler,
  sanitizeInput,
} from './middlewares/security.middleware';
import { globalErrorHandler, notFoundHandler } from './middlewares/error.middleware';

const app = express();

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
  app.use(requestLogger);
}

// Rate limiting - apply globally (except for health and home endpoints)
app.use((req, res, next) => {
  // Skip rate limiting for home endpoints and health checks
  if (req.path.startsWith('/api/home') || req.path.startsWith('/health')) {
    return next();
  }
  rateLimiter(req, res, next);
});

app.use((req, res, next) => {
  // Skip speed limiting for home endpoints and health checks
  if (req.path.startsWith('/api/home') || req.path.startsWith('/health')) {
    return next();
  }
  speedLimiter(req, res, next);
});

// API-specific rate limiting
app.use('/api', apiRateLimiter);

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

// Global error handler (must be last)
app.use(globalErrorHandler);

export default app;
