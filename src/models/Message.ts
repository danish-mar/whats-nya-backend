/**
 * File: Message Model
 * Description: Mongoose schema for WhatsApp messages with BSON media storage and read status
 * Path: ./src/models/Message.ts
 */

import mongoose, { Schema, Document, Model } from 'mongoose';
import { IMessage } from '../types';

export interface IMessageDocument extends Omit<IMessage, '_id'>, Document {}

interface IMessageModel extends Model<IMessageDocument> {
  getChatMessages(
    sessionId: string,
    chatId: string,
    limit?: number,
    skip?: number
  ): Promise<any[]>;
  getUnreadCount(sessionId: string, chatId?: string): Promise<number>;
  markAsRead(sessionId: string, chatId: string, messageIds?: string[]): Promise<any>;
  getMessageWithMedia(messageId: string, sessionId: string): Promise<any>;
}

const messageSchema = new Schema<IMessageDocument>(
  {
    sessionId: {
      type: String,
      required: [true, 'Session ID is required'],
      ref: 'Session',
      index: true,
    },
    messageId: {
      type: String,
      required: [true, 'Message ID is required'],
      index: true,
    },
    chatId: {
      type: String,
      required: [true, 'Chat ID is required'],
      index: true,
    },
    fromMe: {
      type: Boolean,
      default: false,
      index: true,
    },
    sender: {
      type: String,
      required: [true, 'Sender is required'],
    },
    body: {
      type: String,
      default: '',
    },
    timestamp: {
      type: Date,
      required: true,
      index: true,
    },
    hasMedia: {
      type: Boolean,
      default: false,
      index: true,
    },
    mediaUrl: {
      type: String,
    },
    mediaData: {
      type: Buffer,
    },
    mediaType: {
      type: String,
      enum: ['image', 'video', 'audio', 'document', 'sticker', null],
    },
    isGroupMsg: {
      type: Boolean,
      default: false,
      index: true,
    },
    ackStatus: {
      type: Number,
      enum: [0, 1, 2, 3, 4, 5],
      default: 1,
      index: true,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
    },
    readBy: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
    collection: 'messages',
  }
);

// Compound indexes for efficient queries
messageSchema.index({ sessionId: 1, chatId: 1, timestamp: -1 });
messageSchema.index({ sessionId: 1, timestamp: -1 });
messageSchema.index({ messageId: 1, sessionId: 1 }, { unique: true });
messageSchema.index({ sessionId: 1, chatId: 1, isRead: 1 });

// Static method to get chat messages with pagination
messageSchema.statics.getChatMessages = async function (
  sessionId: string,
  chatId: string,
  limit: number = 50,
  skip: number = 0
) {
  return this.find({ sessionId, chatId })
    .sort({ timestamp: -1 })
    .limit(limit)
    .skip(skip)
    .select('-mediaData')
    .lean();
};

// Get unread messages count
messageSchema.statics.getUnreadCount = async function (
  sessionId: string,
  chatId?: string
) {
  const query: any = { sessionId, fromMe: false, isRead: false };
  if (chatId) {
    query.chatId = chatId;
  }
  return this.countDocuments(query);
};

// Mark messages as read
messageSchema.statics.markAsRead = async function (
  sessionId: string,
  chatId: string,
  messageIds?: string[]
) {
  const query: any = { sessionId, chatId, fromMe: false, isRead: false };
  if (messageIds && messageIds.length > 0) {
    query.messageId = { $in: messageIds };
  }
  return this.updateMany(query, {
    $set: { isRead: true, readAt: new Date(), ackStatus: 4 },
  });
};

// Static method to get message with media
messageSchema.statics.getMessageWithMedia = async function (
  messageId: string,
  sessionId: string
) {
  return this.findOne({ messageId, sessionId }).lean();
};

const Message = mongoose.model<IMessageDocument, IMessageModel>('Message', messageSchema);

export default Message;
