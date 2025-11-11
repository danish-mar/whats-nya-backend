/**
 * File: Contact Model
 * Description: Mongoose schema for WhatsApp contacts
 * Path: ./src/models/Contact.ts
 */

import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IContact {
  _id: string;
  sessionId: string;
  contactId: string;
  name?: string;
  pushName?: string;
  phoneNumber: string;
  profilePicUrl?: string;
  isMyContact: boolean;
  isBlocked: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IContactDocument extends Omit<IContact, '_id'>, Document {}

interface IContactModel extends Model<IContactDocument> {
  getSessionContacts(sessionId: string, onlyMyContacts?: boolean): Promise<any[]>;
}

const contactSchema = new Schema<IContactDocument>(
  {
    sessionId: {
      type: String,
      required: [true, 'Session ID is required'],
      ref: 'Session',
      index: true,
    },
    contactId: {
      type: String,
      required: [true, 'Contact ID is required'],
      index: true,
    },
    name: {
      type: String,
      trim: true,
    },
    pushName: {
      type: String,
      trim: true,
    },
    phoneNumber: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
    },
    profilePicUrl: {
      type: String,
    },
    isMyContact: {
      type: Boolean,
      default: false,
      index: true,
    },
    isBlocked: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'contacts',
  }
);

// Compound indexes
contactSchema.index({ sessionId: 1, contactId: 1 }, { unique: true });
contactSchema.index({ sessionId: 1, phoneNumber: 1 });
contactSchema.index({ sessionId: 1, isMyContact: 1 });

// Static method to get all contacts for a session
contactSchema.statics.getSessionContacts = async function (
  sessionId: string,
  onlyMyContacts: boolean = false
) {
  const query: any = { sessionId };
  if (onlyMyContacts) {
    query.isMyContact = true;
  }
  return this.find(query).sort({ name: 1 }).lean();
};

const Contact = mongoose.model<IContactDocument, IContactModel>('Contact', contactSchema);

export default Contact;
