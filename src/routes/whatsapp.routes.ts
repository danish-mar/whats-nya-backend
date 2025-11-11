/**
 * File: WhatsApp Routes
 * Description: Session and device management routes
 * Path: ./src/routes/whatsapp.routes.ts
 */

import { Router } from 'express';
import WhatsAppController from '../controllers/WhatsAppController';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validator';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Session management
router.post('/session', WhatsAppController.createSession);
router.get('/sessions', WhatsAppController.getSessions);
router.get('/session/:sessionId', WhatsAppController.getSession);
router.delete('/session/:sessionId', WhatsAppController.disconnectSession);

// QR code
router.get('/session/:sessionId/qr', WhatsAppController.getQRCode);

// Session info
router.get('/session/:sessionId/info', WhatsAppController.getSessionInfo);

// Profile management
router.put(
  '/session/:sessionId/profile/picture',
  validate([{ field: 'imageBase64', required: true, type: 'string' }]),
  WhatsAppController.updateProfilePicture
);

router.put(
  '/session/:sessionId/profile/status',
  validate([{ field: 'status', required: true, type: 'string' }]),
  WhatsAppController.updateProfileStatus
);

router.get('/session/:sessionId/profile/picture', WhatsAppController.getProfilePicture);

// Logout
router.post('/session/:sessionId/logout', WhatsAppController.logout);

export default router;
