import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config/index';
import logger from '../utils/logger';
import asyncHandler from './asyncHandler';

interface AuthRequest extends Request {
  user?: {
    id: string;
    role: string;
    email?: string;
  };
}

interface JWTPayload {
  id: string; // Auth service uses 'id', not 'userId'
  username: string; // Auth service includes username
  email: string; // Auth service includes email
  roles: string[]; // Auth service uses 'roles' array, not 'role' string
  exp: number;
  iat: number;
}

class AuthMiddleware {
  // Main protection middleware - simple and flexible
  static protect = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
    let token: string | null = null;

    // Try to get token from multiple sources (flexibility)
    // 1. Cookie (preferred for web apps)
    if (req.cookies?.jwt) {
      token = req.cookies.jwt;
    }
    // 2. Authorization header (for API clients)
    else if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.substring(7);
    }

    if (!token) {
      logger.warn('🚫 No authentication token provided:', {
        ip: req.ip,
        path: req.path,
        userAgent: req.get('User-Agent'),
      });
      res.status(401);
      throw new Error('Not authorized, no token');
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      logger.error('❌ JWT_SECRET not configured');
      res.status(500);
      throw new Error('Authentication service misconfigured');
    }

    try {
      // Verify JWT
      const decoded = jwt.verify(token, jwtSecret) as JWTPayload;

      // In a full implementation, you'd fetch user from database here:
      // const user = await User.findById(decoded.userId).select('-password');
      // if (!user) {
      //   res.status(404);
      //   throw new Error('User not found');
      // }

      // For now, use the JWT payload directly (since we don't have a User model)
      req.user = {
        id: decoded.id, // Auth service uses 'id'
        role: decoded.roles[0] || 'customer', // Take first role, default to 'customer'
        email: decoded.email,
      };

      logger.info('✅ Authentication successful:', {
        userId: decoded.id, // Log using the correct field
        role: decoded.roles[0] || 'customer',
        ip: req.ip,
        path: req.path,
      });

      next();
    } catch (error) {
      logger.warn('🚫 Invalid authentication token:', {
        ip: req.ip,
        path: req.path,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(401);
      const message = error instanceof jwt.TokenExpiredError ? 'Token expired' : 'Not authorized, token failed';
      throw new Error(message);
    }
  });

  // Admin role requirement
  static admin = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (req.user && req.user.role === 'admin') {
      logger.info('✅ Admin access granted:', {
        userId: req.user.id,
        ip: req.ip,
        path: req.path,
      });
      next();
    } else {
      logger.warn('🚫 Admin access denied:', {
        userId: req.user?.id || 'unknown',
        role: req.user?.role || 'none',
        ip: req.ip,
        path: req.path,
      });
      res.status(403);
      throw new Error('Admin access required');
    }
  };
}

export default AuthMiddleware;
export { AuthRequest };

// Export convenient aliases for functional style
export const protect = AuthMiddleware.protect;
export const admin = AuthMiddleware.admin;
