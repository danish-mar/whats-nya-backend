/**
 * File: WhatsApp Client Wrapper
 * Description: Wrapper for whatsapp-web.js with session handling
 * Path: ./src/services/whatsapp/WhatsAppClient.ts
 */

import { Client, LocalAuth, Message as WAMessage } from 'whatsapp-web.js';
// import { Session, Message, Chat, Contact } 

import Session from '../../models/Session';
import Message from '../../models/Message';
import Chat from '../../models/Chat';
import Contact from '../../models/Contact';


import { SessionStatus } from '../../types';
import logger from '../../utils/logger';
import config from '../../config/environment';

export interface WhatsAppClientConfig {
  sessionId: string;
  userId: string;
  onQR?: (qr: string) => void;
  onReady?: () => void;
  onMessage?: (message: WAMessage) => void;
  onDisconnected?: () => void;
}

export class WhatsAppClient {
  private client: Client;
  private sessionId: string;
  private userId: string;
  private isInitialized: boolean = false;

  constructor(config: WhatsAppClientConfig) {
    this.sessionId = config.sessionId;
    this.userId = config.userId;

    // Initialize WhatsApp client with local authentication
    this.client = new Client({
      authStrategy: new LocalAuth({
        clientId: this.sessionId,
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
      },
    });

    this.setupEventHandlers(config);
  }

  private setupEventHandlers(config: WhatsAppClientConfig): void {
    // QR Code generation
    this.client.on('qr', async (qr) => {
      logger.info('QR code generated', { sessionId: this.sessionId });
      
      await Session.findOneAndUpdate(
        { sessionId: this.sessionId },
        { status: SessionStatus.QR_SCAN_PENDING, qrCode: qr }
      );

      if (config.onQR) {
        config.onQR(qr);
      }
    });

    // Client ready
    this.client.on('ready', async () => {
      logger.info('WhatsApp client ready', { sessionId: this.sessionId });
      this.isInitialized = true;

      const info = this.client.info;
      await Session.findOneAndUpdate(
        { sessionId: this.sessionId },
        {
          status: SessionStatus.SYNCING,
          phoneNumber: info.wid.user,
          qrCode: null,
        }
      );

      if (config.onReady) {
        config.onReady();
      }

      // Start initial sync after client is ready
      this.startInitialSync();
    });

    // Authenticated
    this.client.on('authenticated', () => {
      logger.info('WhatsApp client authenticated', { sessionId: this.sessionId });
    });

    // Authentication failure
    this.client.on('auth_failure', async (msg) => {
      logger.error('WhatsApp authentication failed', { sessionId: this.sessionId, error: msg });
      
      await Session.findOneAndUpdate(
        { sessionId: this.sessionId },
        { status: SessionStatus.FAILED }
      );
    });

    // Disconnected
    this.client.on('disconnected', async (reason) => {
      logger.warn('WhatsApp client disconnected', { sessionId: this.sessionId, reason });
      this.isInitialized = false;

      await Session.findOneAndUpdate(
        { sessionId: this.sessionId },
        { status: SessionStatus.DISCONNECTED }
      );

      if (config.onDisconnected) {
        config.onDisconnected();
      }
    });

    // Incoming messages
    this.client.on('message', async (message) => {
      try {
        await this.handleIncomingMessage(message);
        
        if (config.onMessage) {
          config.onMessage(message);
        }
      } catch (error) {
        logger.error('Error handling incoming message', { sessionId: this.sessionId, error });
      }
    });

    // Message acknowledgment (read receipts)
    this.client.on('message_ack', async (message, ack) => {
      try {
        await Message.findOneAndUpdate(
          { sessionId: this.sessionId, messageId: message.id._serialized },
          {
            ackStatus: ack,
            isRead: ack >= 4, // 4 = read, 5 = played
            readAt: ack >= 4 ? new Date() : undefined,
          }
        );
      } catch (error) {
        logger.error('Error updating message ack', { sessionId: this.sessionId, error });
      }
    });
  }

  private async handleIncomingMessage(message: WAMessage): Promise<void> {
    try {
      const chat = await message.getChat();
      const contact = await message.getContact();

      // Download media if present
      let mediaData: Buffer | undefined;
      let mediaType: string | undefined;

      if (message.hasMedia) {
        try {
          const media = await message.downloadMedia();
          if (media) {
            mediaData = Buffer.from(media.data, 'base64');
            mediaType = media.mimetype.split('/')[0]; // 'image', 'video', 'audio', 'document'
          }
        } catch (error) {
          logger.error('Failed to download media', { sessionId: this.sessionId, error });
        }
      }

      // Save message to database
      await Message.create({
        sessionId: this.sessionId,
        messageId: message.id._serialized,
        chatId: chat.id._serialized,
        fromMe: message.fromMe,
        sender: contact.id._serialized,
        body: message.body,
        timestamp: new Date(message.timestamp * 1000),
        hasMedia: message.hasMedia,
        mediaData,
        mediaType,
        isGroupMsg: chat.isGroup,
        ackStatus: message.ack || 1,
        isRead: false,
      });

      // Update chat metadata
      await Chat.findOneAndUpdate(
        { sessionId: this.sessionId, chatId: chat.id._serialized },
        {
          name: chat.name,
          isGroup: chat.isGroup,
          lastMessage: message.body,
          lastMessageTime: new Date(message.timestamp * 1000),
          $inc: { unreadCount: message.fromMe ? 0 : 1 },
        },
        { upsert: true }
      );

      logger.debug('Message saved', { sessionId: this.sessionId, messageId: message.id._serialized });
    } catch (error) {
      logger.error('Error handling incoming message', { sessionId: this.sessionId, error });
    }
  }

  private async startInitialSync(): Promise<void> {
    try {
      logger.info('Starting initial sync', { sessionId: this.sessionId });

      const syncDate = new Date();
      syncDate.setDate(syncDate.getDate() - config.whatsapp.syncDays);

      // Get all chats
      const chats = await this.client.getChats();
      const totalChats = chats.length;
      let processedChats = 0;

      for (const chat of chats) {
        try {
          // Save chat
          await Chat.findOneAndUpdate(
            { sessionId: this.sessionId, chatId: chat.id._serialized },
            {
              name: chat.name,
              isGroup: chat.isGroup,
              unreadCount: chat.unreadCount,
              lastMessageTime: chat.lastMessage?.timestamp 
                ? new Date(chat.lastMessage.timestamp * 1000) 
                : undefined,
            },
            { upsert: true }
          );

          // Fetch messages from the last 30 days
          const messages = await chat.fetchMessages({ limit: 1000 });
          
          for (const message of messages) {
            const messageDate = new Date(message.timestamp * 1000);
            if (messageDate < syncDate) continue;

            // Download media if present
            let mediaData: Buffer | undefined;
            let mediaType: string | undefined;

            if (message.hasMedia) {
              try {
                const media = await message.downloadMedia();
                if (media) {
                  mediaData = Buffer.from(media.data, 'base64');
                  mediaType = media.mimetype.split('/')[0];
                }
              } catch (error) {
                logger.error('Failed to download media during sync', { 
                  sessionId: this.sessionId, 
                  error 
                });
              }
            }

            const contact = await message.getContact();

            // Save message (update if exists)
            await Message.findOneAndUpdate(
              { sessionId: this.sessionId, messageId: message.id._serialized },
              {
                chatId: chat.id._serialized,
                fromMe: message.fromMe,
                sender: contact.id._serialized,
                body: message.body,
                timestamp: messageDate,
                hasMedia: message.hasMedia,
                mediaData,
                mediaType,
                isGroupMsg: chat.isGroup,
                ackStatus: message.ack || 1,
                isRead: message.fromMe ? true : false,
              },
              { upsert: true }
            );
          }

          processedChats++;
          const progress = Math.round((processedChats / totalChats) * 100);

          // Update sync progress
          await Session.findOneAndUpdate(
            { sessionId: this.sessionId },
            { syncProgress: progress }
          );

          logger.debug('Chat synced', { 
            sessionId: this.sessionId, 
            chatId: chat.id._serialized,
            progress: `${progress}%`
          });

        } catch (error) {
          logger.error('Error syncing chat', { sessionId: this.sessionId, error });
        }
      }

      // Sync contacts
      await this.syncContacts();

      // Mark session as ready
      await Session.findOneAndUpdate(
        { sessionId: this.sessionId },
        {
          status: SessionStatus.READY,
          syncProgress: 100,
          lastSyncedAt: new Date(),
        }
      );

      logger.info('Initial sync completed', { sessionId: this.sessionId });

    } catch (error) {
      logger.error('Error during initial sync', { sessionId: this.sessionId, error });
      
      await Session.findOneAndUpdate(
        { sessionId: this.sessionId },
        { status: SessionStatus.FAILED }
      );
    }
  }

  private async syncContacts(): Promise<void> {
    try {
      const contacts = await this.client.getContacts();

      for (const contact of contacts) {
        await Contact.findOneAndUpdate(
          { sessionId: this.sessionId, contactId: contact.id._serialized },
          {
            name: contact.name,
            pushName: contact.pushname,
            phoneNumber: contact.number,
            profilePicUrl: await contact.getProfilePicUrl().catch(() => undefined),
            isMyContact: contact.isMyContact,
            isBlocked: contact.isBlocked,
          },
          { upsert: true }
        );
      }

      logger.info('Contacts synced', { sessionId: this.sessionId, count: contacts.length });
    } catch (error) {
      logger.error('Error syncing contacts', { sessionId: this.sessionId, error });
    }
  }

  public async initialize(): Promise<void> {
    try {
      await this.client.initialize();
    } catch (error) {
      logger.error('Failed to initialize WhatsApp client', { sessionId: this.sessionId, error });
      throw error;
    }
  }

  public async destroy(): Promise<void> {
    try {
      await this.client.destroy();
      this.isInitialized = false;
      logger.info('WhatsApp client destroyed', { sessionId: this.sessionId });
    } catch (error) {
      logger.error('Error destroying WhatsApp client', { sessionId: this.sessionId, error });
    }
  }

  public getClient(): Client {
    return this.client;
  }

  public isReady(): boolean {
    return this.isInitialized;
  }

  public getSessionId(): string {
    return this.sessionId;
  }

  public getUserId(): string {
    return this.userId;
  }
}
