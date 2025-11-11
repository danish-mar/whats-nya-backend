/**
 * File: Chat Model
 * Description: Mongoose schema for WhatsApp chats/conversations
 * Path: ./src/models/Chat.ts
 */

import mongoose, { Schema, Document, Model } from 'mongoose';
import { IChat } from '../types';

export interface IChatDocument extends Omit<IChat, '_id'>, Document {}

interface IChatModel extends Model<IChatDocument> {
  getSessionChats(sessionId: string, limit?: number, skip?: number): Promise<any[]>;
  updateChatMetadata(
    sessionId: string,
    chatId: string,
    lastMessage: string,
    lastMessageTime: Date
  ): Promise<any>;
}

const chatSchema = new Schema<IChatDocument>(
  {
    sessionId: {
      type: String,
      required: [true, 'Session ID is required'],
      ref: 'Session',
      index: true,
    },
    chatId: {
      type: String,
      required: [true, 'Chat ID is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Chat name is required'],
      trim: true,
    },
    isGroup: {
      type: Boolean,
      default: false,
      index: true,
    },
    participants: {
      type: [String],
      default: [],
    },
    lastMessage: {
      type: String,
    },
    lastMessageTime: {
      type: Date,
      index: true,
    },
    unreadCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
    collection: 'chats',
  }
);

// Compound indexes
chatSchema.index({ sessionId: 1, chatId: 1 }, { unique: true });
chatSchema.index({ sessionId: 1, lastMessageTime: -1 });
chatSchema.index({ sessionId: 1, isGroup: 1 });

// Static method to get all chats for a session
chatSchema.statics.getSessionChats = async function (
  sessionId: string,
  limit: number = 100,
  skip: number = 0
) {
  return this.find({ sessionId })
    .sort({ lastMessageTime: -1 })
    .limit(limit)
    .skip(skip)
    .lean();
};

// Static method to update chat metadata
chatSchema.statics.updateChatMetadata = async function (
  sessionId: string,
  chatId: string,
  lastMessage: string,
  lastMessageTime: Date
) {
  return this.findOneAndUpdate(
    { sessionId, chatId },
    {
      lastMessage,
      lastMessageTime,
      $inc: { unreadCount: 1 },
    },
    { new: true, upsert: true }
  );
};

const Chat = mongoose.model<IChatDocument, IChatModel>('Chat', chatSchema);

export default Chat;
