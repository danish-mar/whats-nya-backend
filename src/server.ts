/**
 * File: Server Entry Point (COMPLETE with Session Restoration)
 * Description: Main server file that starts the application
 * Path: ./server/src/server.ts
 */

import http from 'http';
import app from './app';
import config from './config/environment';
import database from './config/database';
import logger from './utils/logger';
import SessionManager from './services/whatsapp/SessionManager';
import SocketManager from './services/whatsapp/SocketManager';

class Server {
  private server: http.Server;
  private port: number;

  constructor() {
    this.port = config.port;
    this.server = http.createServer(app);
  }

  private async connectDatabase(): Promise<void> {
    try {
      await database.connect();
      logger.info('✅ Database connected successfully');
    } catch (error) {
      logger.error('❌ Failed to connect to database', error);
      process.exit(1);
    }
  }

  private initializeSocketIO(): void {
    SocketManager.initialize(this.server);
    logger.info('✅ Socket.IO initialized for real-time events');
  }

  private async restoreWhatsAppSessions(): Promise<void> {
    try {
      logger.info('🔄 Restoring WhatsApp sessions from disk...');
      await SessionManager.restoreSessions();
      logger.info('✅ WhatsApp session restoration completed');
    } catch (error) {
      logger.error('❌ Failed to restore WhatsApp sessions', error);
    }
  }

  private setupGracefulShutdown(): void {
    const gracefulShutdown = async (signal: string) => {
      logger.info(`⚠️  ${signal} received, shutting down gracefully`);

      this.server.close(async () => {
        logger.info('🔌 HTTP server closed');

        // Disconnect all WhatsApp sessions
        const sessions = SessionManager.getAllSessions();
        logger.info(`📱 Disconnecting ${sessions.size} active sessions...`);
        
        for (const [sessionId, client] of sessions) {
          try {
            await client.destroy();
            logger.info(`✅ Session ${sessionId} destroyed`);
          } catch (error) {
            logger.error(`❌ Error destroying session ${sessionId}`, error);
          }
        }

        await database.disconnect();
        logger.info('🗄️  Database connection closed');

        logger.info('👋 Shutdown complete');
        process.exit(0);
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.error('⏰ Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    };

    // Listen for termination signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('💥 Uncaught Exception', error);
      gracefulShutdown('uncaughtException');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('💥 Unhandled Rejection at:', { promise, reason });
      gracefulShutdown('unhandledRejection');
    });
  }

  public async start(): Promise<void> {
    try {
      logger.info('🚀 Starting Nya.chat server...\n');

      // Connect to database
      await this.connectDatabase();

      // Initialize Socket.IO
      this.initializeSocketIO();

      // Restore WhatsApp sessions (no QR code needed!)
      await this.restoreWhatsAppSessions();

      // Setup graceful shutdown
      this.setupGracefulShutdown();

      // Start server
      this.server.listen(this.port, () => {
        logger.info('═══════════════════════════════════════════════════════');
        logger.info(`🎉 Nya.chat server started successfully!`);
        logger.info('═══════════════════════════════════════════════════════');
        logger.info(`📡 API:       http://192.168.1.72:${this.port}/${config.apiVersion}`);
        logger.info(`🔌 WebSocket: ws://192.168.1.72:${this.port}`);
        logger.info(`🌍 Environment: ${config.nodeEnv}`);
        logger.info(`📦 API Version: ${config.apiVersion}`);
        logger.info('═══════════════════════════════════════════════════════\n');
      });
    } catch (error) {
      logger.error('❌ Failed to start server', error);
      process.exit(1);
    }
  }
}

// Create and start the server
const server = new Server();
server.start();

// Export for testing purposes
export default server;
