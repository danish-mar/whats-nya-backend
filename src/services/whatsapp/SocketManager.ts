/**
 * File: Socket Manager (FIXED)
 * Path: ./server/src/services/socket/SocketManager.ts
 */

import { Server as HTTPServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import { WSEvents } from '../../types';
import logger from '../../utils/logger';
import TokenService from '../auth/TokenService';

class SocketManager {
  private io: SocketServer | null = null;
  private userSockets: Map<string, Set<string>> = new Map();

  initialize(server: HTTPServer): void {
    this.io = new SocketServer(server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
    });

    this.setupMiddleware();
    this.setupConnectionHandler();

    logger.info('Socket.IO initialized');
  }

  private setupMiddleware(): void {
    this.io?.use((socket, next) => {
      const token = socket.handshake.auth.token;

      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const payload = TokenService.verifyToken(token);
      if (!payload) {
        return next(new Error('Invalid or expired token'));
      }

      // Attach user data to socket
      (socket as any).userId = payload.userId;
      next();
    });
  }

  private setupConnectionHandler(): void {
    this.io?.on('connection', (socket: Socket) => {
      const userId = (socket as any).userId;
      logger.info('Socket connected', { userId, socketId: socket.id });

      // Automatically join user room
      socket.join(`user:${userId}`);
      logger.info('Socket joined user room', { userId, room: `user:${userId}` });

      // Track user's socket
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)?.add(socket.id);

      // Handle disconnection
      socket.on('disconnect', () => {
        logger.info('Socket disconnected', { userId, socketId: socket.id });
        this.userSockets.get(userId)?.delete(socket.id);

        if (this.userSockets.get(userId)?.size === 0) {
          this.userSockets.delete(userId);
        }
      });

      // Join session-specific rooms
      socket.on('join_session', (sessionId: string) => {
        socket.join(`session:${sessionId}`);
        logger.debug('Socket joined session room', { userId, sessionId });
      });

      socket.on('leave_session', (sessionId: string) => {
        socket.leave(`session:${sessionId}`);
        logger.debug('Socket left session room', { userId, sessionId });
      });
    });
  }

  emitToUser(userId: string, event: WSEvents, data: any): void {
    logger.info('Emitting to user', { userId, event, room: `user:${userId}` });
    this.io?.to(`user:${userId}`).emit(event, data);
  }

  emitToSession(sessionId: string, event: WSEvents, data: any): void {
    this.io?.to(`session:${sessionId}`).emit(event, data);
  }

  emitQRCode(sessionId: string, userId: string, qrCode: string): void {
    this.emitToUser(userId, WSEvents.QR_CODE, { sessionId, qrCode });
  }

  emitSessionStatus(sessionId: string, userId: string, status: string): void {
    this.emitToUser(userId, WSEvents.SESSION_STATUS, { sessionId, status });
  }

  // FIX: Change to emit to USER, not session
  emitMessage(sessionId: string, userId: string, message: any): void {
    logger.info('Emitting message to user', { 
      sessionId, 
      userId, 
      messageId: message._id,
      room: `user:${userId}`
    });
    
    this.emitToUser(userId, WSEvents.MESSAGE_RECEIVED, {
      sessionId,
      message,
    });
  }

  emitSyncProgress(sessionId: string, userId: string, progress: number): void {
    this.emitToUser(userId, WSEvents.SYNC_PROGRESS, { sessionId, progress });
  }

  emitError(userId: string, error: string): void {
    this.emitToUser(userId, WSEvents.ERROR, { error });
  }

  getIO(): SocketServer | null {
    return this.io;
  }
}

export default new SocketManager();
