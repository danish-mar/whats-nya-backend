/**
 * File: Message Routes (FIXED)
 * Description: Message operations routes
 * Path: ./server/src/routes/message.routes.ts
 */

import { Router } from 'express';
import MessageController from '../controllers/MessageController';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validator';
import { messageLimiter } from '../middleware/rateLimiter';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Send messages (with rate limiting)
router.post(
  '/:sessionId/send',
  messageLimiter,
  validate([
    { field: 'chatId', required: true, type: 'string' },
    { field: 'message', required: true, type: 'string' },
  ]),
  MessageController.sendMessage.bind(MessageController)
);

router.post(
  '/:sessionId/send-media',
  messageLimiter,
  validate([
    { field: 'chatId', required: true, type: 'string' },
    { field: 'mediaBase64', required: true, type: 'string' },
    { field: 'mimetype', required: true, type: 'string' },
    { field: 'caption', required: false, type: 'string' },
    { field: 'filename', required: false, type: 'string' },
  ]),
  MessageController.sendMedia.bind(MessageController)
);

// Get messages
router.get(
  '/:sessionId/chat/:chatId',
  MessageController.getMessages.bind(MessageController)
);

// Mark as read
router.post(
  '/:sessionId/chat/:chatId/read',
  validate([{ field: 'messageIds', required: false, type: 'array' }]),
  MessageController.markAsRead.bind(MessageController)
);

// Get unread count
router.get(
  '/:sessionId/unread',
  MessageController.getUnreadCount.bind(MessageController)
);

// Delete message
router.delete(
  '/:sessionId/message/:messageId',
  validate([{ field: 'forEveryone', required: false, type: 'boolean' }]),
  MessageController.deleteMessage.bind(MessageController)
);

export default router;
