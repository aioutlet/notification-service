import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { Request, Response, NextFunction } from 'express';
import config from '../config/index';
import logger from '../utils/logger';

// Rate limiting configuration
export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes',
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req: Request, res: Response) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`, {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
    });
    res.status(429).json({
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: '15 minutes',
    });
  },
});

// Stricter rate limiting for API endpoints
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each IP to 50 API requests per windowMs
  message: {
    error: 'Too many API requests from this IP, please try again later.',
    retryAfter: '15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    logger.warn(`API rate limit exceeded for IP: ${req.ip}`, {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
    });
    res.status(429).json({
      error: 'Too many API requests from this IP, please try again later.',
      retryAfter: '15 minutes',
    });
  },
});

// Speed limiter (progressive delays)
export const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 10, // Allow 10 requests per windowMs without delay
  delayMs: 500, // Add 500ms delay per request after delayAfter
  maxDelayMs: 10000, // Maximum delay of 10 seconds
});

// CORS configuration
export const corsOptions = {
  origin: function (origin: string | undefined, callback: Function) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);

    // In production, you should specify allowed origins
    const allowedOrigins =
      config.server.env === 'production'
        ? process.env.ALLOWED_ORIGINS?.split(',') || []
        : ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000'];

    if (allowedOrigins.includes(origin) || config.server.env === 'development') {
      callback(null, true);
    } else {
      logger.warn(`CORS: Origin not allowed: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200, // Some legacy browsers choke on 204
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};

// Helmet configuration for security headers
export const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Disable for API-only service
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
});

// Compression middleware
export const compressionMiddleware = compression({
  filter: (req: Request, res: Response) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  threshold: 1024, // Only compress if response is larger than 1KB
});

// Request logging middleware
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      contentLength: res.get('Content-Length') || '0',
    };

    if (res.statusCode >= 400) {
      logger.warn('Request completed with error:', logData);
    } else {
      logger.info('Request completed:', logData);
    }
  });

  next();
};

// Error handling for security middleware
export const securityErrorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err.message === 'Not allowed by CORS') {
    logger.warn(`CORS error for origin: ${req.get('Origin')}`, {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
    });
    return res.status(403).json({
      error: 'CORS: Origin not allowed',
    });
  }

  // Handle other security-related errors
  if (err.name === 'PayloadTooLargeError') {
    logger.warn('Payload too large:', {
      ip: req.ip,
      contentLength: req.get('Content-Length'),
      path: req.path,
    });
    return res.status(413).json({
      error: 'Payload too large',
    });
  }

  next(err);
};

// Input sanitization middleware
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  // Basic sanitization - remove null bytes and trim strings
  const sanitizeObject = (obj: any): any => {
    if (typeof obj === 'string') {
      return obj.replace(/\0/g, '').trim();
    }
    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    }
    if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          sanitized[key] = sanitizeObject(obj[key]);
        }
      }
      return sanitized;
    }
    return obj;
  };

  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }

  next();
};

export default {
  rateLimiter,
  apiRateLimiter,
  speedLimiter,
  corsOptions,
  helmetConfig,
  compressionMiddleware,
  requestLogger,
  securityErrorHandler,
  sanitizeInput,
};
