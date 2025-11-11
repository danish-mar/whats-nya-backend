/**
 * File: Session Manager (FIXED restoration)
 * Path: ./server/src/services/whatsapp/SessionManager.ts
 */

import { Client, LocalAuth, ClientInfo } from 'whatsapp-web.js';
import Session from '../../models/Session';
import Chat from '../../models/Chat';
import Message from '../../models/Message';
import { SessionStatus } from '../../types';
import config from '../../config/environment';
import logger from '../../utils/logger';
import SocketManager from './SocketManager';

export interface SessionCallbacks {
  onQR?: (qr: string) => void | Promise<void>;
  onReady?: () => void | Promise<void>;
  onDisconnected?: () => void | Promise<void>;
}

class SessionManager {
  private sessions: Map<string, Client> = new Map();

  /**
 * Restore existing session from saved auth
 */
async restoreSession(
  sessionId: string,
  userId: string,
  callbacks: SessionCallbacks = {}
): Promise<void> {
  try {
    logger.info('Restoring WhatsApp session', { sessionId, userId });

    // Update session status to initializing
    await Session.findOneAndUpdate(
      { sessionId },
      { status: SessionStatus.INITIALIZING }
    );

    // Initialize client with the SAME sessionId (this will use saved auth)
    await this.initializeClient(sessionId, userId, callbacks);

    logger.info('Session restore initiated', { sessionId });
  } catch (error: any) {
    logger.error('Failed to restore session', { sessionId, error: error.message });
    await Session.findOneAndUpdate(
      { sessionId },
      { status: SessionStatus.FAILED }
    );
    throw error;
  }
}

/**
 * Restore all sessions from database on server startup
 */
async restoreSessions(): Promise<void> {
  try {
    // Find all sessions that were previously ready or syncing
    const sessions = await Session.find({
      status: { $in: [SessionStatus.READY, SessionStatus.SYNCING, SessionStatus.DISCONNECTED] },
    });

    logger.info('Found sessions to restore', { count: sessions.length });

    if (sessions.length === 0) {
      logger.info('No sessions to restore');
      return;
    }

    // Restore each session
    for (const session of sessions) {
      try {
        logger.info('Attempting to restore session', {
          sessionId: session.sessionId,
          userId: session.userId,
          phoneNumber: session.phoneNumber,
        });

        // Restore without creating a new sessionId
        await this.restoreSession(session.sessionId, session.userId);
      } catch (error: any) {
        logger.error('Failed to restore session', {
          sessionId: session.sessionId,
          error: error.message,
        });
      }
    }

    logger.info('Session restoration completed');
  } catch (error: any) {
    logger.error('Failed to restore sessions', { error: error.message });
  }
}


  generateSessionId(): string {
    return `${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  async createSession(
    userId: string,
    callbacks: SessionCallbacks = {}
  ): Promise<{ sessionId: string; session: any }> {
    logger.info('Creating WhatsApp session', { userId });

    const activeCount = await Session.getActiveSessionsCount(userId);
    if (activeCount >= config.whatsapp.maxSessionsPerUser) {
      throw new Error(`Maximum ${config.whatsapp.maxSessionsPerUser} sessions allowed`);
    }

    const sessionId = this.generateSessionId();

    try {
      const sessionDoc = await Session.create({
        userId,
        sessionId,
        status: SessionStatus.INITIALIZING,
      });

      await this.initializeClient(sessionId, userId, callbacks);

      return { sessionId, session: sessionDoc };
    } catch (error) {
      logger.error('Error creating session', { userId, error });
      throw error;
    }
  }

  // Separate method to initialize client (used for both create and restore)
  private async initializeClient(
    sessionId: string,
    userId: string,
    callbacks: SessionCallbacks = {}
  ): Promise<void> {
    const client = new Client({
      authStrategy: new LocalAuth({
        clientId: sessionId,
        dataPath: './.wwebjs_auth',
      }),
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
        ],
        timeout: 60000,
      },
      webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
      },
    });

    this.setupClientHandlers(client, sessionId, userId, callbacks);
    this.sessions.set(sessionId, client);

    client.initialize().catch(async (error) => {
      logger.error('Failed to initialize WhatsApp client', { sessionId, error });
      await Session.findOneAndUpdate({ sessionId }, { status: SessionStatus.FAILED });
      this.sessions.delete(sessionId);
    });
  }

  private setupClientHandlers(
    client: Client,
    sessionId: string,
    userId: string,
    callbacks: SessionCallbacks
  ): void {
    // QR Code handler
    client.on('qr', async (qr) => {
      logger.info('QR Code generated', { sessionId });
      await Session.findOneAndUpdate(
        { sessionId },
        { status: SessionStatus.QR_SCAN_PENDING, qrCode: qr }
      );
      SocketManager.emitQRCode(sessionId, userId, qr);
      await callbacks.onQR?.(qr);
    });

    // Ready handler
    client.on('ready', async () => {
      logger.info('Client is ready', { sessionId });
      const info: ClientInfo = client.info;
      await Session.findOneAndUpdate(
        { sessionId },
        {
          status: SessionStatus.READY,
          phoneNumber: info.wid.user,
          qrCode: null,
        }
      );
      SocketManager.emitSessionStatus(sessionId, userId, SessionStatus.READY);
      await callbacks.onReady?.();
      this.startBackgroundSync(sessionId, client, userId);
    });

    // Message handler
    client.on('message', async (message) => {
      try {
        logger.info('New message received', {
          sessionId,
          chatId: message.from,
          messageId: message.id._serialized,
          body: message.body?.substring(0, 50),
          fromMe: message.fromMe,
        });

        const messageDoc = await Message.collection.insertOne({
          sessionId,
          chatId: message.from,
          messageId: message.id._serialized,
          body: message.body || '',
          timestamp: new Date(message.timestamp * 1000),
          fromMe: message.fromMe,
          sender: message.from,
          isGroupMsg: message.isGroupMsg || false,
          ackStatus: message.ack || 0,
          hasMedia: message.hasMedia,
          isRead: message.fromMe,
          readBy: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const savedMessage = await Message.findById(messageDoc.insertedId);

        if (savedMessage) {
          SocketManager.emitMessage(sessionId, userId, savedMessage);
          logger.info('Message emitted via WebSocket', { sessionId, messageId: message.id._serialized });
        }

        await Chat.findOneAndUpdate(
          { sessionId, chatId: message.from },
          {
            lastMessage: message.body || '',
            lastMessageTime: new Date(message.timestamp * 1000),
            $inc: { unreadCount: message.fromMe ? 0 : 1 },
          }
        );
      } catch (error: any) {
        if (error.code !== 11000) {
          logger.error('Error handling incoming message', { sessionId, error: error.message });
        }
      }
    });

    // Message ACK handler
    client.on('message_ack', async (message, ack) => {
      try {
        await Message.findOneAndUpdate(
          { sessionId, messageId: message.id._serialized },
          { ackStatus: ack }
        );
      } catch (error: any) {
        logger.error('Error updating message ACK', { sessionId, error: error.message });
      }
    });

    client.on('authenticated', () => {
      logger.info('Client authenticated', { sessionId });
    });

    client.on('auth_failure', async (msg) => {
      logger.error('Authentication failure', { sessionId, msg });
      await Session.findOneAndUpdate({ sessionId }, { status: SessionStatus.FAILED });
    });

    client.on('disconnected', async (reason) => {
      logger.warn('Client disconnected', { sessionId, reason });
      await Session.findOneAndUpdate({ sessionId }, { status: SessionStatus.DISCONNECTED });
      await callbacks.onDisconnected?.();
      this.sessions.delete(sessionId);
    });
  }

  private async startBackgroundSync(sessionId: string, client: Client, userId: string): Promise<void> {
    try {
      const session = await Session.findOne({ sessionId });
      if (!session) return;

      await Session.findOneAndUpdate(
        { sessionId },
        { status: SessionStatus.SYNCING, syncProgress: 0 }
      );

      SocketManager.emitSyncProgress(sessionId, userId, 0);

      const chats = await client.getChats();
      const totalChats = chats.length;
      
      logger.info('Starting background sync', { sessionId, totalChats });

      for (let i = 0; i < totalChats; i++) {
        const chat = chats[i];
        const progress = Math.round(((i + 1) / totalChats) * 100);
        
        try {
          const messages = await chat.fetchMessages({ limit: 50 });
          const lastMessage = messages.length > 0 ? messages[0] : null;

          await Chat.findOneAndUpdate(
            { sessionId, chatId: chat.id._serialized },
            {
              sessionId,
              chatId: chat.id._serialized,
              name: chat.name || chat.id.user,
              isGroup: chat.isGroup,
              participants: chat.isGroup ? chat.participants.map((p: any) => p.id._serialized) : [],
              lastMessage: lastMessage?.body || '',
              lastMessageTime: lastMessage?.timestamp ? new Date(lastMessage.timestamp * 1000) : new Date(),
              unreadCount: chat.unreadCount || 0,
            },
            { upsert: true, new: true }
          );

          let savedCount = 0;
          for (const msg of messages) {
            try {
              await Message.collection.insertOne({
                sessionId,
                chatId: chat.id._serialized,
                messageId: msg.id._serialized,
                body: msg.body || '',
                timestamp: new Date(msg.timestamp * 1000),
                fromMe: msg.fromMe,
                sender: msg.from,
                isGroupMsg: msg.isGroupMsg || false,
                ackStatus: msg.ack || 0,
                hasMedia: msg.hasMedia,
                isRead: msg.fromMe,
                readBy: [],
                createdAt: new Date(),
                updatedAt: new Date(),
              });
              savedCount++;
            } catch (msgError: any) {
              if (msgError.code !== 11000) {
                logger.error('Failed to save message', {
                  sessionId,
                  messageId: msg.id._serialized,
                  error: msgError.message,
                });
              }
            }
          }

          logger.info('Chat synced', {
            sessionId,
            chatId: chat.id._serialized,
            name: chat.name,
            messagesSaved: savedCount,
            progress: `${i + 1}/${totalChats}`,
          });
        } catch (chatError: any) {
          logger.error('Failed to sync chat', {
            sessionId,
            chatId: chat.id._serialized,
            error: chatError.message,
          });
        }
        
        await Session.findOneAndUpdate({ sessionId }, { syncProgress: progress });
        SocketManager.emitSyncProgress(sessionId, userId, progress);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      await Session.findOneAndUpdate(
        { sessionId },
        {
          status: SessionStatus.READY,
          syncProgress: 100,
          lastSyncedAt: new Date(),
        }
      );

      SocketManager.emitSessionStatus(sessionId, userId, SessionStatus.READY);
      logger.info('Background sync completed', { sessionId, totalChats });
    } catch (error: any) {
      logger.error('Background sync failed', { sessionId, error: error.message });
      const session = await Session.findOne({ sessionId });
      if (session) {
        await Session.findOneAndUpdate({ sessionId }, { status: SessionStatus.FAILED });
        SocketManager.emitSessionStatus(sessionId, session.userId, SessionStatus.FAILED);
      }
    }
  }

  getSession(sessionId: string): Client | null {
    return this.sessions.get(sessionId) || null;
  }

  getAllSessions(): Map<string, Client> {
    return this.sessions;
  }

  async destroySession(sessionId: string): Promise<void> {
    const client = this.sessions.get(sessionId);
    if (client) {
      await client.destroy();
      this.sessions.delete(sessionId);
    }
    await Session.findOneAndUpdate({ sessionId }, { status: SessionStatus.DISCONNECTED });
    logger.info('Session destroyed', { sessionId });
  }
}

export default new SessionManager();
