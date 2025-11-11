/**
 * File: WhatsApp Session Model
 * Description: Mongoose schema for WhatsApp session management
 * Path: ./src/models/Session.ts
 */

import mongoose, { Schema, Document, Model } from 'mongoose';
import { IWhatsAppSession, SessionStatus } from '../types';

export interface ISessionDocument extends Omit<IWhatsAppSession, '_id'>, Document {
  isActive(): boolean;
}

interface ISessionModel extends Model<ISessionDocument> {
  getActiveSessionsCount(userId: string): Promise<number>;
}

const sessionSchema = new Schema<ISessionDocument>(
  {
    userId: {
      type: String,
      required: [true, 'User ID is required'],
      ref: 'User',
      index: true,
    },
    sessionId: {
      type: String,
      required: [true, 'Session ID is required'],
      unique: true,
      index: true,
    },
    phoneNumber: {
      type: String,
      trim: true,
      sparse: true,
    },
    status: {
      type: String,
      enum: Object.values(SessionStatus),
      default: SessionStatus.INITIALIZING,
      index: true,
    },
    qrCode: {
      type: String,
      select: false,
    },
    syncProgress: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    lastSyncedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    collection: 'sessions',
  }
);

// Compound index for user sessions
sessionSchema.index({ userId: 1, status: 1 });
sessionSchema.index({ userId: 1, createdAt: -1 });

// Method to check if session is active
sessionSchema.methods.isActive = function (): boolean {
  return this.status === SessionStatus.READY;
};

// Static method to get user's active sessions count
sessionSchema.statics.getActiveSessionsCount = async function (
  userId: string
): Promise<number> {
  return this.countDocuments({
    userId,
    status: { $in: [SessionStatus.READY, SessionStatus.SYNCING] },
  });
};

const Session = mongoose.model<ISessionDocument, ISessionModel>('Session', sessionSchema);

export default Session;
