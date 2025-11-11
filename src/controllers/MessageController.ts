/**
 * File: Message Controller (FIXED)
 * Description: Handles message operations (send, receive, read, delete)
 * Path: ./server/src/controllers/MessageController.ts
 */

import { Response } from 'express';
import { AuthRequest } from '../types';
import SessionManager from '../services/whatsapp/SessionManager';

import Message from '../models/Message';
import Session from '../models/Session';

import { ResponseUtil } from '../utils/response';
import logger from '../utils/logger';
import { MessageMedia } from 'whatsapp-web.js';
import SocketManager from '../services/whatsapp/SocketManager'; 

class MessageController {
  // Send text message
  async sendMessage(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        ResponseUtil.unauthorized(res);
        return;
      }

      const { sessionId } = req.params;
      const { chatId, message } = req.body;

      logger.info('Attempting to send message', { sessionId, chatId, message });

      if (!chatId || !message) {
        ResponseUtil.badRequest(res, 'chatId and message are required');
        return;
      }

      // Verify session ownership
      const sessionDoc = await Session.findOne({ sessionId, userId: req.user.userId });
      if (!sessionDoc) {
        ResponseUtil.notFound(res, 'Session not found');
        return;
      }

      // Get the WhatsApp client directly
      const client = SessionManager.getSession(sessionId);
      if (!client) {
        logger.error('Session not found in SessionManager', { sessionId });
        ResponseUtil.badRequest(res, 'Session is not ready');
        return;
      }

      logger.info('Client found, sending message...', { sessionId, chatId });

      // Send the message
      const sentMessage = await client.sendMessage(chatId, message);

      logger.info('Message sent successfully', {
        sessionId,
        chatId,
        messageId: sentMessage.id._serialized,
      });

      // Save to database
      const messageDoc = await Message.create({
        sessionId,
        chatId,
        messageId: sentMessage.id._serialized,
        body: message,
        timestamp: new Date(sentMessage.timestamp * 1000),
        fromMe: true,
        sender: sentMessage.from,
        isGroupMsg: chatId.includes('@g.us'),
        ackStatus: sentMessage.ack || 1,
        hasMedia: false,
      });

    //   // Emit via WebSocket
    //   SocketManager.emitMessage(sessionId, req.user.userId, messageDoc);

      ResponseUtil.success(res, 'Message sent successfully', {
        message: messageDoc,
      });
    } catch (error: any) {
      logger.error('Error sending message', {
        error: error.message,
        stack: error.stack,
        sessionId: req.params.sessionId,
        body: req.body,
      });
      ResponseUtil.error(res, error.message || 'Failed to send message');
    }
  }

  // Send media message
  async sendMedia(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        ResponseUtil.unauthorized(res);
        return;
      }

      const { sessionId } = req.params;
      const { chatId, mediaBase64, mimetype, caption, filename } = req.body;

      if (!chatId || !mediaBase64 || !mimetype) {
        ResponseUtil.badRequest(res, 'chatId, mediaBase64, and mimetype are required');
        return;
      }

      const sessionDoc = await Session.findOne({ sessionId, userId: req.user.userId });
      if (!sessionDoc) {
        ResponseUtil.notFound(res, 'Session not found');
        return;
      }

      const client = SessionManager.getSession(sessionId);
      if (!client) {
        ResponseUtil.badRequest(res, 'Session is not ready');
        return;
      }

      const media = new MessageMedia(mimetype, mediaBase64, filename);
      const sentMessage = await client.sendMessage(chatId, media, { caption });

      // Save to database with media
      const messageDoc = await Message.create({
        sessionId,
        messageId: sentMessage.id._serialized,
        chatId,
        fromMe: true,
        sender: sentMessage.from,
        body: caption || '',
        timestamp: new Date(sentMessage.timestamp * 1000),
        hasMedia: true,
        mediaType: mimetype.split('/')[0],
        isGroupMsg: chatId.includes('@g.us'),
        ackStatus: sentMessage.ack || 1,
      });

      SocketManager.emitMessage(sessionId, req.user.userId, messageDoc);

      ResponseUtil.success(res, 'Media sent successfully', {
        message: messageDoc,
      });
    } catch (error: any) {
      logger.error('Error sending media', error);
      ResponseUtil.error(res, 'Failed to send media');
    }
  }

  // Get messages from a chat
  async getMessages(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        ResponseUtil.unauthorized(res);
        return;
      }

      const { sessionId, chatId } = req.params;
      const { limit = 50, skip = 0 } = req.query;

      logger.info('Fetching messages', { sessionId, chatId, limit, skip });

      const sessionDoc = await Session.findOne({ sessionId, userId: req.user.userId });
      if (!sessionDoc) {
        ResponseUtil.notFound(res, 'Session not found');
        return;
      }

      const messages = await Message.find({ sessionId, chatId })
        .sort({ timestamp: 1 }) // Oldest first
        .limit(Number(limit))
        .skip(Number(skip));

      logger.info('Messages fetched', {
        sessionId,
        chatId,
        count: messages.length,
      });

      ResponseUtil.success(res, 'Messages retrieved', {
        messages,
        count: messages.length,
      });
    } catch (error: any) {
      logger.error('Error getting messages', {
        error: error.message,
        stack: error.stack,
        sessionId: req.params.sessionId,
        chatId: req.params.chatId,
      });
      ResponseUtil.error(res, 'Failed to retrieve messages');
    }
  }

  // Mark messages as read
  async markAsRead(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        ResponseUtil.unauthorized(res);
        return;
      }

      const { sessionId, chatId } = req.params;
      const { messageIds } = req.body;

      logger.info('Marking as read', { sessionId, chatId, messageIds });

      const sessionDoc = await Session.findOne({ sessionId, userId: req.user.userId });
      if (!sessionDoc) {
        ResponseUtil.notFound(res, 'Session not found');
        return;
      }

      // Mark in WhatsApp
      const client = SessionManager.getSession(sessionId);
      if (client) {
        try {
          const chat = await client.getChatById(chatId);
          await chat.sendSeen();
          logger.info('Chat marked as seen in WhatsApp', { sessionId, chatId });
        } catch (error) {
          logger.error('Failed to mark as seen in WhatsApp', { sessionId, chatId, error });
        }
      }

      // Mark in database
      if (messageIds && messageIds.length > 0) {
        await Message.updateMany(
          { sessionId, chatId, messageId: { $in: messageIds } },
          { $set: { isRead: true } }
        );
      } else {
        await Message.updateMany(
          { sessionId, chatId, fromMe: false },
          { $set: { isRead: true } }
        );
      }

      ResponseUtil.success(res, 'Messages marked as read');
    } catch (error: any) {
      logger.error('Error marking messages as read', {
        error: error.message,
        stack: error.stack,
      });
      ResponseUtil.error(res, 'Failed to mark messages as read');
    }
  }

  // Get unread message count
  async getUnreadCount(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        ResponseUtil.unauthorized(res);
        return;
      }

      const { sessionId } = req.params;
      const { chatId } = req.query;

      const sessionDoc = await Session.findOne({ sessionId, userId: req.user.userId });
      if (!sessionDoc) {
        ResponseUtil.notFound(res, 'Session not found');
        return;
      }

      const query: any = { sessionId, fromMe: false, isRead: false };
      if (chatId) {
        query.chatId = chatId;
      }

      const count = await Message.countDocuments(query);

      ResponseUtil.success(res, 'Unread count retrieved', { unreadCount: count });
    } catch (error: any) {
      logger.error('Error getting unread count', error);
      ResponseUtil.error(res, 'Failed to retrieve unread count');
    }
  }

  // Delete message
  async deleteMessage(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        ResponseUtil.unauthorized(res);
        return;
      }

      const { sessionId, messageId } = req.params;
      const { forEveryone = false } = req.body;

      const sessionDoc = await Session.findOne({ sessionId, userId: req.user.userId });
      if (!sessionDoc) {
        ResponseUtil.notFound(res, 'Session not found');
        return;
      }

      const client = SessionManager.getSession(sessionId);
      if (!client) {
        ResponseUtil.badRequest(res, 'Session is not ready');
        return;
      }

      const message = await client.getMessageById(messageId);
      if (!message) {
        ResponseUtil.notFound(res, 'Message not found');
        return;
      }

      await message.delete(forEveryone);

      // Delete from database
      await Message.findOneAndDelete({ sessionId, messageId });

      ResponseUtil.success(res, 'Message deleted successfully');
    } catch (error: any) {
      logger.error('Error deleting message', error);
      ResponseUtil.error(res, 'Failed to delete message');
    }
  }
}

export default new MessageController();
