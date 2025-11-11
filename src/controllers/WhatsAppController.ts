/**
 * File: WhatsApp Controller
 * Description: Handles WhatsApp session and device operations
 * Path: ./src/controllers/WhatsAppController.ts
 */

import { Response } from 'express';
import { AuthRequest } from '../types';
import SessionManager from '../services/whatsapp/SessionManager';
import QRManager from '../services/whatsapp/QRManager';
import SocketManager from '../services/whatsapp/SocketManager';
import Session  from '../models/Session';
import { ResponseUtil } from '../utils/response';
import logger from '../utils/logger';
import { SessionStatus } from '../types';

class WhatsAppController {
    // Create new WhatsApp session
    async createSession(req: AuthRequest, res: Response): Promise<void> {
    try {
        if (!req.user) {
        ResponseUtil.unauthorized(res);
        return;
        }

        // Set timeout for the request
        req.setTimeout(60000); // 60 seconds timeout

        const { sessionId, session } = await SessionManager.createSession(
        req.user.userId,
        {
            onQR: async (qr) => {
            const qrDataURL = await QRManager.generateQRCodeDataURL(qr);
            SocketManager.emitQRCode(sessionId, req.user!.userId, qrDataURL);
            },
            onReady: () => {
            SocketManager.emitSessionStatus(sessionId, req.user!.userId, SessionStatus.READY);
            },
            onDisconnected: () => {
            SocketManager.emitSessionStatus(sessionId, req.user!.userId, SessionStatus.DISCONNECTED);
            },
        }
        );

        ResponseUtil.success(res, 'WhatsApp session created', { sessionId }, 201);
    } catch (error: any) {
        logger.error('Error creating session', error);
        ResponseUtil.badRequest(res, error.message || 'Failed to create session');
    }
    }


  // Get all user sessions
  async getSessions(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        ResponseUtil.unauthorized(res);
        return;
      }

      const sessions = await Session.find({ userId: req.user.userId }).sort({ createdAt: -1 });

      ResponseUtil.success(res, 'Sessions retrieved', { sessions });
    } catch (error: any) {
      logger.error('Error getting sessions', error);
      ResponseUtil.error(res, 'Failed to retrieve sessions');
    }
  }

  // Get specific session details
  async getSession(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        ResponseUtil.unauthorized(res);
        return;
      }

      const { sessionId } = req.params;

      const session = await Session.findOne({ sessionId, userId: req.user.userId });
      if (!session) {
        ResponseUtil.notFound(res, 'Session not found');
        return;
      }

      ResponseUtil.success(res, 'Session retrieved', { session });
    } catch (error: any) {
      logger.error('Error getting session', error);
      ResponseUtil.error(res, 'Failed to retrieve session');
    }
  }

  // Get QR code for session
  async getQRCode(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        ResponseUtil.unauthorized(res);
        return;
      }

      const { sessionId } = req.params;
      const { format = 'dataurl' } = req.query;

      const session = await Session.findOne({ 
        sessionId, 
        userId: req.user.userId 
      }).select('+qrCode');

      if (!session) {
        ResponseUtil.notFound(res, 'Session not found');
        return;
      }

      if (!session.qrCode) {
        ResponseUtil.badRequest(res, 'QR code not available. Session may already be connected.');
        return;
      }

      let qrCode: string;
      switch (format) {
        case 'svg':
          qrCode = await QRManager.generateQRCodeSVG(session.qrCode);
          break;
        case 'buffer':
          const buffer = await QRManager.generateQRCodeBuffer(session.qrCode);
          res.setHeader('Content-Type', 'image/png');
          res.send(buffer);
          return;
        default:
          qrCode = await QRManager.generateQRCodeDataURL(session.qrCode);
      }

      ResponseUtil.success(res, 'QR code retrieved', { qrCode });
    } catch (error: any) {
      logger.error('Error getting QR code', error);
      ResponseUtil.error(res, 'Failed to retrieve QR code');
    }
  }

  // Disconnect session
  async disconnectSession(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        ResponseUtil.unauthorized(res);
        return;
      }

      const { sessionId } = req.params;

      const session = await Session.findOne({ sessionId, userId: req.user.userId });
      if (!session) {
        ResponseUtil.notFound(res, 'Session not found');
        return;
      }

      await SessionManager.destroySession(sessionId);

      ResponseUtil.success(res, 'Session disconnected successfully');
    } catch (error: any) {
      logger.error('Error disconnecting session', error);
      ResponseUtil.error(res, 'Failed to disconnect session');
    }
  }

  // Get session info (phone number, profile pic, etc.)
  async getSessionInfo(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        ResponseUtil.unauthorized(res);
        return;
      }

      const { sessionId } = req.params;

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
      const info = waClient.info;

      ResponseUtil.success(res, 'Session info retrieved', {
        phoneNumber: info.wid.user,
        platform: info.platform,
        pushname: info.pushname,
      });
    } catch (error: any) {
      logger.error('Error getting session info', error);
      ResponseUtil.error(res, 'Failed to retrieve session info');
    }
  }

  // Update profile picture
  async updateProfilePicture(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        ResponseUtil.unauthorized(res);
        return;
      }

      const { sessionId } = req.params;
      const { imageBase64 } = req.body;

      const client = await SessionManager.getSession(sessionId);
      if (!client || !client.isReady()) {
        ResponseUtil.badRequest(res, 'Session is not ready');
        return;
      }

      const waClient = client.getClient();
      await waClient.setProfilePicture(imageBase64);

      ResponseUtil.success(res, 'Profile picture updated successfully');
    } catch (error: any) {
      logger.error('Error updating profile picture', error);
      ResponseUtil.error(res, 'Failed to update profile picture');
    }
  }

  // Update profile status
  async updateProfileStatus(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        ResponseUtil.unauthorized(res);
        return;
      }

      const { sessionId } = req.params;
      const { status } = req.body;

      const client = await SessionManager.getSession(sessionId);
      if (!client || !client.isReady()) {
        ResponseUtil.badRequest(res, 'Session is not ready');
        return;
      }

      const waClient = client.getClient();
      await waClient.setStatus(status);

      ResponseUtil.success(res, 'Profile status updated successfully');
    } catch (error: any) {
      logger.error('Error updating profile status', error);
      ResponseUtil.error(res, 'Failed to update profile status');
    }
  }

  // Get profile picture
  async getProfilePicture(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        ResponseUtil.unauthorized(res);
        return;
      }

      const { sessionId } = req.params;
      const { contactId } = req.query;

      const client = await SessionManager.getSession(sessionId);
      if (!client || !client.isReady()) {
        ResponseUtil.badRequest(res, 'Session is not ready');
        return;
      }

      const waClient = client.getClient();
      const picUrl = await waClient.getProfilePicUrl(contactId as string || waClient.info.wid._serialized);

      ResponseUtil.success(res, 'Profile picture retrieved', { profilePicUrl: picUrl });
    } catch (error: any) {
      logger.error('Error getting profile picture', error);
      ResponseUtil.error(res, 'Failed to retrieve profile picture');
    }
  }

  // Logout and destroy session
  async logout(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        ResponseUtil.unauthorized(res);
        return;
      }

      const { sessionId } = req.params;

      const client = await SessionManager.getSession(sessionId);
      if (!client) {
        ResponseUtil.notFound(res, 'Session not found');
        return;
      }

      const waClient = client.getClient();
      await waClient.logout();
      await SessionManager.destroySession(sessionId);

      ResponseUtil.success(res, 'Logged out successfully');
    } catch (error: any) {
      logger.error('Error logging out', error);
      ResponseUtil.error(res, 'Failed to logout');
    }
  }
}

export default new WhatsAppController();
