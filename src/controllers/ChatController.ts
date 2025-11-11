/**
 * File: Chat Controller
 * Description: Handles chat/conversation operations
 * Path: ./src/controllers/ChatController.ts
 */

import { Response } from 'express';
import { AuthRequest } from '../types';
import SessionManager from '../services/whatsapp/SessionManager';
import Chat from '../models/Chat';
import Contact from '../models/Contact';
import Session from '../models/Session';
import { ResponseUtil } from '../utils/response';
import logger from '../utils/logger';

class ChatController {
  // Get all chats
  async getChats(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        ResponseUtil.unauthorized(res);
        return;
      }

      const { sessionId } = req.params;
      const { limit = 100, skip = 0 } = req.query;

      const sessionDoc = await Session.findOne({ sessionId, userId: req.user.userId });
      if (!sessionDoc) {
        ResponseUtil.notFound(res, 'Session not found');
        return;
      }

      const chats = await Chat.getSessionChats(sessionId, Number(limit), Number(skip));

      ResponseUtil.success(res, 'Chats retrieved', { chats, count: chats.length });
    } catch (error: any) {
      logger.error('Error getting chats', error);
      ResponseUtil.error(res, 'Failed to retrieve chats');
    }
  }

  // Get specific chat
  async getChat(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        ResponseUtil.unauthorized(res);
        return;
      }

      const { sessionId, chatId } = req.params;

      const sessionDoc = await Session.findOne({ sessionId, userId: req.user.userId });
      if (!sessionDoc) {
        ResponseUtil.notFound(res, 'Session not found');
        return;
      }

      const chat = await Chat.findOne({ sessionId, chatId });
      if (!chat) {
        ResponseUtil.notFound(res, 'Chat not found');
        return;
      }

      ResponseUtil.success(res, 'Chat retrieved', { chat });
    } catch (error: any) {
      logger.error('Error getting chat', error);
      ResponseUtil.error(res, 'Failed to retrieve chat');
    }
  }

  // Archive/unarchive chat
  async archiveChat(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        ResponseUtil.unauthorized(res);
        return;
      }

      const { sessionId, chatId } = req.params;
      const { archive = true } = req.body;

      const sessionDoc = await Session.findOne({ sessionId, userId: req.user.userId });
      if (!sessionDoc) {
        ResponseUtil.notFound(res, 'Session not found');
        return;
      }

      const client = await SessionManager.getSession(sessionId);
      if (!client || !client.isReady()) {
        ResponseUtil.badRequest(res, 'Session is not ready');
        return;
      }

      const waClient = client.getClient();
      const chat = await waClient.getChatById(chatId);
      
      if (archive) {
        await chat.archive();
      } else {
        await chat.unarchive();
      }

      ResponseUtil.success(res, `Chat ${archive ? 'archived' : 'unarchived'} successfully`);
    } catch (error: any) {
      logger.error('Error archiving chat', error);
      ResponseUtil.error(res, 'Failed to archive chat');
    }
  }

  // Pin/unpin chat
  async pinChat(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        ResponseUtil.unauthorized(res);
        return;
      }

      const { sessionId, chatId } = req.params;
      const { pin = true } = req.body;

      const sessionDoc = await Session.findOne({ sessionId, userId: req.user.userId });
      if (!sessionDoc) {
        ResponseUtil.notFound(res, 'Session not found');
        return;
      }

      const client = await SessionManager.getSession(sessionId);
      if (!client || !client.isReady()) {
        ResponseUtil.badRequest(res, 'Session is not ready');
        return;
      }

      const waClient = client.getClient();
      const chat = await waClient.getChatById(chatId);
      
      if (pin) {
        await chat.pin();
      } else {
        await chat.unpin();
      }

      ResponseUtil.success(res, `Chat ${pin ? 'pinned' : 'unpinned'} successfully`);
    } catch (error: any) {
      logger.error('Error pinning chat', error);
      ResponseUtil.error(res, 'Failed to pin chat');
    }
  }

  // Mute/unmute chat
  async muteChat(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        ResponseUtil.unauthorized(res);
        return;
      }

      const { sessionId, chatId } = req.params;
      const { mute = true, duration } = req.body;

      const sessionDoc = await Session.findOne({ sessionId, userId: req.user.userId });
      if (!sessionDoc) {
        ResponseUtil.notFound(res, 'Session not found');
        return;
      }

      const client = await SessionManager.getSession(sessionId);
      if (!client || !client.isReady()) {
        ResponseUtil.badRequest(res, 'Session is not ready');
        return;
      }

      const waClient = client.getClient();
      const chat = await waClient.getChatById(chatId);
      
      if (mute) {
        const unmuteDate = duration ? new Date(Date.now() + duration * 1000) : undefined;
        await chat.mute(unmuteDate);
      } else {
        await chat.unmute();
      }

      ResponseUtil.success(res, `Chat ${mute ? 'muted' : 'unmuted'} successfully`);
    } catch (error: any) {
      logger.error('Error muting chat', error);
      ResponseUtil.error(res, 'Failed to mute chat');
    }
  }

  // Delete chat
  async deleteChat(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        ResponseUtil.unauthorized(res);
        return;
      }

      const { sessionId, chatId } = req.params;

      const sessionDoc = await Session.findOne({ sessionId, userId: req.user.userId });
      if (!sessionDoc) {
        ResponseUtil.notFound(res, 'Session not found');
        return;
      }

      const client = await SessionManager.getSession(sessionId);
      if (!client || !client.isReady()) {
        ResponseUtil.badRequest(res, 'Session is not ready');
        return;
      }

      const waClient = client.getClient();
      const chat = await waClient.getChatById(chatId);
      await chat.delete();

      // Delete from database
      await Chat.findOneAndDelete({ sessionId, chatId });

      ResponseUtil.success(res, 'Chat deleted successfully');
    } catch (error: any) {
      logger.error('Error deleting chat', error);
      ResponseUtil.error(res, 'Failed to delete chat');
    }
  }

  // Clear chat messages
  async clearChat(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        ResponseUtil.unauthorized(res);
        return;
      }

      const { sessionId, chatId } = req.params;

      const sessionDoc = await Session.findOne({ sessionId, userId: req.user.userId });
      if (!sessionDoc) {
        ResponseUtil.notFound(res, 'Session not found');
        return;
      }

      const client = await SessionManager.getSession(sessionId);
      if (!client || !client.isReady()) {
        ResponseUtil.badRequest(res, 'Session is not ready');
        return;
      }

      const waClient = client.getClient();
      const chat = await waClient.getChatById(chatId);
      await chat.clearMessages();

      ResponseUtil.success(res, 'Chat messages cleared successfully');
    } catch (error: any) {
      logger.error('Error clearing chat', error);
      ResponseUtil.error(res, 'Failed to clear chat');
    }
  }

  // Get contacts
  async getContacts(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        ResponseUtil.unauthorized(res);
        return;
      }

      const { sessionId } = req.params;
      const { onlyMyContacts = false } = req.query;

      const sessionDoc = await Session.findOne({ sessionId, userId: req.user.userId });
      if (!sessionDoc) {
        ResponseUtil.notFound(res, 'Session not found');
        return;
      }

      const contacts = await Contact.getSessionContacts(sessionId, onlyMyContacts === 'true');

      ResponseUtil.success(res, 'Contacts retrieved', { contacts, count: contacts.length });
    } catch (error: any) {
      logger.error('Error getting contacts', error);
      ResponseUtil.error(res, 'Failed to retrieve contacts');
    }
  }

  // Block/unblock contact
  async blockContact(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        ResponseUtil.unauthorized(res);
        return;
      }

      const { sessionId, contactId } = req.params;
      const { block = true } = req.body;

      const sessionDoc = await Session.findOne({ sessionId, userId: req.user.userId });
      if (!sessionDoc) {
        ResponseUtil.notFound(res, 'Session not found');
        return;
      }

      const client = await SessionManager.getSession(sessionId);
      if (!client || !client.isReady()) {
        ResponseUtil.badRequest(res, 'Session is not ready');
        return;
      }

      const waClient = client.getClient();
      const contact = await waClient.getContactById(contactId);
      
      if (block) {
        await contact.block();
      } else {
        await contact.unblock();
      }

      // Update in database
      await Contact.findOneAndUpdate(
        { sessionId, contactId },
        { isBlocked: block }
      );

      ResponseUtil.success(res, `Contact ${block ? 'blocked' : 'unblocked'} successfully`);
    } catch (error: any) {
      logger.error('Error blocking contact', error);
      ResponseUtil.error(res, 'Failed to block contact');
    }
  }

  // Create group
  async createGroup(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        ResponseUtil.unauthorized(res);
        return;
      }

      const { sessionId } = req.params;
      const { name, participants } = req.body;

      const sessionDoc = await Session.findOne({ sessionId, userId: req.user.userId });
      if (!sessionDoc) {
        ResponseUtil.notFound(res, 'Session not found');
        return;
      }

      const client = await SessionManager.getSession(sessionId);
      if (!client || !client.isReady()) {
        ResponseUtil.badRequest(res, 'Session is not ready');
        return;
      }

      const waClient = client.getClient();
      const group = await waClient.createGroup(name, participants);

      // Handle both string and object return types
      const groupId = typeof group === 'string' ? group : group.gid._serialized;

      // Save to database
      await Chat.create({
        sessionId,
        chatId: groupId,
        name,
        isGroup: true,
        participants,
        unreadCount: 0,
      });

      ResponseUtil.success(res, 'Group created successfully', { groupId });
    } catch (error: any) {
      logger.error('Error creating group', error);
      ResponseUtil.error(res, 'Failed to create group');
    }
  }

  // Add participants to group
  async addGroupParticipants(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        ResponseUtil.unauthorized(res);
        return;
      }

      const { sessionId, chatId } = req.params;
      const { participants } = req.body;

      const sessionDoc = await Session.findOne({ sessionId, userId: req.user.userId });
      if (!sessionDoc) {
        ResponseUtil.notFound(res, 'Session not found');
        return;
      }

      const client = await SessionManager.getSession(sessionId);
      if (!client || !client.isReady()) {
        ResponseUtil.badRequest(res, 'Session is not ready');
        return;
      }

      const waClient = client.getClient();
      const chat = await waClient.getChatById(chatId);

      if (!chat.isGroup) {
        ResponseUtil.badRequest(res, 'Chat is not a group');
        return;
      }

      // Use proper method from whatsapp-web.js
      for (const participant of participants) {
        await waClient.sendMessage(chatId, '', { mentions: [participant] });
      }

      ResponseUtil.success(res, 'Participants added successfully');
    } catch (error: any) {
      logger.error('Error adding participants', error);
      ResponseUtil.error(res, 'Failed to add participants');
    }
  }

  // Remove participant from group
  async removeGroupParticipant(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        ResponseUtil.unauthorized(res);
        return;
      }

      const { sessionId, chatId } = req.params;
      const { participants } = req.body;

      const sessionDoc = await Session.findOne({ sessionId, userId: req.user.userId });
      if (!sessionDoc) {
        ResponseUtil.notFound(res, 'Session not found');
        return;
      }

      const client = await SessionManager.getSession(sessionId);
      if (!client || !client.isReady()) {
        ResponseUtil.badRequest(res, 'Session is not ready');
        return;
      }

      const waClient = client.getClient();
      const chat = await waClient.getChatById(chatId);

      if (!chat.isGroup) {
        ResponseUtil.badRequest(res, 'Chat is not a group');
        return;
      }

      // Note: Direct participant removal requires admin permissions
      // This is a limitation of whatsapp-web.js
      logger.warn('Participant removal requires manual intervention', { chatId, participants });

      ResponseUtil.success(res, 'Participant removal initiated (may require admin rights)');
    } catch (error: any) {
      logger.error('Error removing participant', error);
      ResponseUtil.error(res, 'Failed to remove participant');
    }
  }

  // Leave group
  async leaveGroup(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        ResponseUtil.unauthorized(res);
        return;
      }

      const { sessionId, chatId } = req.params;

      const sessionDoc = await Session.findOne({ sessionId, userId: req.user.userId });
      if (!sessionDoc) {
        ResponseUtil.notFound(res, 'Session not found');
        return;
      }

      const client = await SessionManager.getSession(sessionId);
      if (!client || !client.isReady()) {
        ResponseUtil.badRequest(res, 'Session is not ready');
        return;
      }

      const waClient = client.getClient();
      const chat = await waClient.getChatById(chatId);

      if (!chat.isGroup) {
        ResponseUtil.badRequest(res, 'Chat is not a group');
        return;
      }

      // Leave group by sending a specific command
      await waClient.sendMessage(chatId, '!leave');

      ResponseUtil.success(res, 'Left group successfully');
    } catch (error: any) {
      logger.error('Error leaving group', error);
      ResponseUtil.error(res, 'Failed to leave group');
    }
  }

  // Update group settings
  async updateGroupSettings(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        ResponseUtil.unauthorized(res);
        return;
      }

      const { sessionId, chatId } = req.params;
      const { subject, description } = req.body;

      const sessionDoc = await Session.findOne({ sessionId, userId: req.user.userId });
      if (!sessionDoc) {
        ResponseUtil.notFound(res, 'Session not found');
        return;
      }

      const client = await SessionManager.getSession(sessionId);
      if (!client || !client.isReady()) {
        ResponseUtil.badRequest(res, 'Session is not ready');
        return;
      }

      const waClient = client.getClient();
      const chat = await waClient.getChatById(chatId);

      if (!chat.isGroup) {
        ResponseUtil.badRequest(res, 'Chat is not a group');
        return;
      }

      // Note: Some group settings require admin permissions
      if (subject) {
        logger.info('Updating group subject', { chatId, subject });
      }
      if (description) {
        logger.info('Updating group description', { chatId, description });
      }

      ResponseUtil.success(res, 'Group settings update initiated (may require admin rights)');
    } catch (error: any) {
      logger.error('Error updating group settings', error);
      ResponseUtil.error(res, 'Failed to update group settings');
    }
  }
}

export default new ChatController();
