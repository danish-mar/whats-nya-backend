/**
 * File: Auth Middleware
 * Description: JWT authentication middleware for protected routes
 * Path: ./src/middleware/auth.ts
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import TokenService from '../services/auth/TokenService';
import { ResponseUtil } from '../utils/response';
import logger from '../utils/logger';

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      ResponseUtil.unauthorized(res, 'No token provided');
      return;
    }

    const token = authHeader.split(' ')[1];

    // Verify token
    const payload = TokenService.verifyToken(token);
    if (!payload) {
      ResponseUtil.unauthorized(res, 'Invalid or expired token');
      return;
    }

    // Attach user to request
    req.user = payload;
    next();
  } catch (error: any) {
    logger.error('Authentication error', error);
    ResponseUtil.unauthorized(res, 'Authentication failed');
  }
};

export const optionalAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const payload = TokenService.verifyToken(token);
      if (payload) {
        req.user = payload;
      }
    }
    next();
  } catch (error) {
    next();
  }
};
