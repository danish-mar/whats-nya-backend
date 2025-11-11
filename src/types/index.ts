/**
 * File: Global TypeScript type definitions
 * Description: Shared types and interfaces for the entire application
 * Path: ./src/types/index.ts
 */

import { Request } from 'express';

// User related types
export interface IUser {
  _id: string;
  email: string;
  password: string;
  name?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserPayload {
  userId: string;
  email: string;
}

// Session related types
export enum SessionStatus {
  INITIALIZING = 'initializing',
  QR_SCAN_PENDING = 'qr_scan_pending',
  SYNCING = 'syncing',
  READY = 'ready',
  DISCONNECTED = 'disconnected',
  FAILED = 'failed'
}

export interface IWhatsAppSession {
  _id: string;
  userId: string;
  sessionId: string;
  phoneNumber?: string;
  status: SessionStatus;
  qrCode?: string;
  syncProgress?: number;
  lastSyncedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Message related types
export interface IMessage {
  _id: string;
  sessionId: string;
  messageId: string;
  chatId: string;
  fromMe: boolean;
  sender: string;
  body: string;
  timestamp: Date;
  hasMedia: boolean;
  mediaUrl?: string;
  mediaData?: Buffer; // BSON storage
  mediaType?: string;
  isGroupMsg: boolean;
  ackStatus: number;
  isRead: boolean;
  readAt: Date;
  readBy: string[];
}

// Chat related types
export interface IChat {
  _id: string;
  sessionId: string;
  chatId: string;
  name: string;
  isGroup: boolean;
  participants?: string[];
  lastMessage?: string;
  lastMessageTime?: Date;
  unreadCount: number;
}

// Express request extension
export interface AuthRequest extends Request {
  user?: IUserPayload;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

// WebSocket event types
export enum WSEvents {
  QR_CODE = 'qr_code',
  SESSION_STATUS = 'session_status',
  MESSAGE_RECEIVED = 'message_received',
  SYNC_PROGRESS = 'sync_progress',
  ERROR = 'error'
}
