/**
 * File: Auth Routes
 * Description: Authentication API routes
 * Path: ./src/routes/auth.routes.ts
 */

import { Router } from 'express';
import AuthController from '../controllers/AuthController';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validator';

const router = Router();

// Public routes
router.post(
  '/register',
  validate([
    { field: 'email', required: true, type: 'email' },
    { field: 'password', required: true, type: 'string', minLength: 6 },
    { field: 'name', required: false, type: 'string', maxLength: 100 },
  ]),
  AuthController.register
);

router.post(
  '/login',
  validate([
    { field: 'email', required: true, type: 'email' },
    { field: 'password', required: true, type: 'string' },
  ]),
  AuthController.login
);

router.post(
  '/refresh',
  validate([{ field: 'refreshToken', required: true, type: 'string' }]),
  AuthController.refreshToken
);

// Protected routes
router.get('/profile', authenticate, AuthController.getProfile);

router.put(
  '/profile',
  authenticate,
  validate([{ field: 'name', required: false, type: 'string', maxLength: 100 }]),
  AuthController.updateProfile
);

router.post(
  '/change-password',
  authenticate,
  validate([
    { field: 'currentPassword', required: true, type: 'string' },
    { field: 'newPassword', required: true, type: 'string', minLength: 6 },
  ]),
  AuthController.changePassword
);

export default router;
