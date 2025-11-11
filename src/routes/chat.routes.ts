/**
 * File: Chat Routes
 * Description: Chat and contact management routes
 * Path: ./src/routes/chat.routes.ts
 */

import { Router } from 'express';
import ChatController from '../controllers/ChatController';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validator';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get chats
router.get('/:sessionId', ChatController.getChats);
router.get('/:sessionId/chat/:chatId', ChatController.getChat);

// Chat actions
router.post(
  '/:sessionId/chat/:chatId/archive',
  validate([{ field: 'archive', required: false, type: 'boolean' }]),
  ChatController.archiveChat
);

router.post(
  '/:sessionId/chat/:chatId/pin',
  validate([{ field: 'pin', required: false, type: 'boolean' }]),
  ChatController.pinChat
);

router.post(
  '/:sessionId/chat/:chatId/mute',
  validate([
    { field: 'mute', required: false, type: 'boolean' },
    { field: 'duration', required: false, type: 'number' },
  ]),
  ChatController.muteChat
);

router.delete('/:sessionId/chat/:chatId', ChatController.deleteChat);
router.post('/:sessionId/chat/:chatId/clear', ChatController.clearChat);

// Contacts
router.get('/:sessionId/contacts', ChatController.getContacts);

router.post(
  '/:sessionId/contact/:contactId/block',
  validate([{ field: 'block', required: false, type: 'boolean' }]),
  ChatController.blockContact
);

// Group management
router.post(
  '/:sessionId/group',
  validate([
    { field: 'name', required: true, type: 'string' },
    { field: 'participants', required: true, type: 'array' },
  ]),
  ChatController.createGroup
);

router.post(
  '/:sessionId/group/:chatId/participants/add',
  validate([{ field: 'participants', required: true, type: 'array' }]),
  ChatController.addGroupParticipants
);

router.post(
  '/:sessionId/group/:chatId/participants/remove',
  validate([{ field: 'participants', required: true, type: 'array' }]),
  ChatController.removeGroupParticipant
);

router.post('/:sessionId/group/:chatId/leave', ChatController.leaveGroup);

router.put(
  '/:sessionId/group/:chatId/settings',
  validate([
    { field: 'subject', required: false, type: 'string' },
    { field: 'description', required: false, type: 'string' },
  ]),
  ChatController.updateGroupSettings
);

export default router;
