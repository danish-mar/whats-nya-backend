/**
 * File: Auth Controller
 * Description: Handles authentication HTTP requests
 * Path: ./src/controllers/AuthController.ts
 */

import { Request, Response } from 'express';
import { AuthRequest } from '../types';
import AuthService from '../services/auth/AuthService';
import { ResponseUtil } from '../utils/response';
import logger from '../utils/logger';

class AuthController {
  async register(req: Request, res: Response): Promise<void> {
    try {
      const { email, password, name } = req.body;

      const result = await AuthService.register({ email, password, name });

      ResponseUtil.success(
        res,
        'User registered successfully',
        {
          user: {
            id: result.user._id,
            email: result.user.email,
            name: result.user.name,
          },
          tokens: result.tokens,
        },
        201
      );
    } catch (error: any) {
      logger.error('Registration error', error);
      ResponseUtil.badRequest(res, error.message || 'Registration failed');
    }
  }

  async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;

      const result = await AuthService.login({ email, password });

      ResponseUtil.success(res, 'Login successful', {
        user: {
          id: result.user._id,
          email: result.user.email,
          name: result.user.name,
        },
        tokens: result.tokens,
      });
    } catch (error: any) {
      logger.error('Login error', error);
      ResponseUtil.unauthorized(res, error.message || 'Login failed');
    }
  }

  async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;

      const tokens = await AuthService.refreshToken(refreshToken);

      ResponseUtil.success(res, 'Token refreshed successfully', { tokens });
    } catch (error: any) {
      logger.error('Token refresh error', error);
      ResponseUtil.unauthorized(res, error.message || 'Token refresh failed');
    }
  }

  async getProfile(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        ResponseUtil.unauthorized(res);
        return;
      }

      const user = await AuthService.getUserById(req.user.userId);
      if (!user) {
        ResponseUtil.notFound(res, 'User not found');
        return;
      }

      ResponseUtil.success(res, 'Profile retrieved successfully', {
        id: user._id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
      });
    } catch (error: any) {
      logger.error('Get profile error', error);
      ResponseUtil.error(res, 'Failed to retrieve profile');
    }
  }

  async updateProfile(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        ResponseUtil.unauthorized(res);
        return;
      }

      const { name } = req.body;
      const user = await AuthService.updateProfile(req.user.userId, { name });

      if (!user) {
        ResponseUtil.notFound(res, 'User not found');
        return;
      }

      ResponseUtil.success(res, 'Profile updated successfully', {
        id: user._id,
        email: user.email,
        name: user.name,
      });
    } catch (error: any) {
      logger.error('Update profile error', error);
      ResponseUtil.error(res, 'Failed to update profile');
    }
  }

  async changePassword(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        ResponseUtil.unauthorized(res);
        return;
      }

      const { currentPassword, newPassword } = req.body;
      await AuthService.changePassword(req.user.userId, currentPassword, newPassword);

      ResponseUtil.success(res, 'Password changed successfully');
    } catch (error: any) {
      logger.error('Change password error', error);
      ResponseUtil.badRequest(res, error.message || 'Failed to change password');
    }
  }
}

export default new AuthController();
