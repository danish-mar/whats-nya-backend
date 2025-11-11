/**
 * File: Routes Index
 * Description: Central router configuration
 * Path: ./src/routes/index.ts
 */

import { Router } from 'express';
import authRoutes from './auth.routes';
import whatsappRoutes from './whatsapp.routes';
import messageRoutes from './message.routes';
import chatRoutes from './chat.routes';
import config from '../config/environment';

const router = Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Nya.chat API is running',
    timestamp: new Date().toISOString(),
    version: config.apiVersion,
  });
});

// Mount routes
router.use('/auth', authRoutes);
router.use('/whatsapp', whatsappRoutes);
router.use('/messages', messageRoutes);
router.use('/chats', chatRoutes);

export default router;
