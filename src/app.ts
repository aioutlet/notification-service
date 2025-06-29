import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import homeRoutes from './routes/home.routes';
import notificationRoutes from './routes/notification.routes';
import templateRoutes from './routes/template.routes';
import monitoringRoutes from './routes/monitoring.routes';
import logger from './utils/logger';
import config from './config/index';
import MonitoringService from './services/monitoring.service';
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

const app = express();
const monitoring = MonitoringService.getInstance();

// Security middleware - must be applied first
app.use(helmetConfig); // Security headers
app.use(cors(corsOptions)); // CORS configuration
app.use(compressionMiddleware); // Response compression
app.use(cookieParser()); // Cookie parsing support

// HTTP metrics middleware
app.use(monitoring.httpMetricsMiddleware());

// Request size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Input sanitization
app.use(sanitizeInput);

// Request logging
if (config.server.env !== 'test') {
  app.use(requestLogger);
}

// Rate limiting - apply globally (except for health endpoints)
app.use((req, res, next) => {
  // Skip rate limiting for health and metrics endpoints
  if (req.path.startsWith('/health') || req.path.startsWith('/metrics') || req.path === '/ready') {
    return next();
  }
  rateLimiter(req, res, next);
});

app.use((req, res, next) => {
  // Skip speed limiting for health and metrics endpoints
  if (req.path.startsWith('/health') || req.path.startsWith('/metrics') || req.path === '/ready') {
    return next();
  }
  speedLimiter(req, res, next);
});

// API-specific rate limiting
app.use('/api', apiRateLimiter);

// Health checks and system endpoints (no rate limiting)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
  });
});

app.get('/ready', (req, res) => {
  // This endpoint is enhanced in server.ts for shutdown detection
  res.status(200).json({
    status: 'ready',
    timestamp: new Date().toISOString(),
  });
});

app.get('/version', (req, res) => {
  res.json({
    name: 'notification-service',
    version: process.env.npm_package_version || '1.0.0',
    environment: config.server.env,
    node: process.version,
  });
});

// Welcome endpoint
app.get('/', (req, res) => {
  res.json({
    message: '🔔 Notification Service API',
    version: process.env.npm_package_version || '1.0.0',
    environment: config.server.env,
    endpoints: {
      health: '/health',
      ready: '/ready',
      version: '/version',
      metrics: '/metrics',
      stats: '/stats',
      notifications: '/api/notifications',
      templates: '/api/templates',
    },
  });
});

// Monitoring and metrics routes (no additional rate limiting)
app.use('/', monitoringRoutes);

// Routes
app.use('/api/home', homeRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/templates', templateRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
  });
});

// Security error handler
app.use(securityErrorHandler);

// Global error handler
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
  });

  // Don't expose stack traces in production
  const isDevelopment = config.server.env === 'development';

  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Internal server error',
    error: isDevelopment
      ? {
          stack: error.stack,
          details: error,
        }
      : undefined,
    timestamp: new Date().toISOString(),
  });
});

export default app;
