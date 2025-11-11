/**
 * File: MongoDB database connection
 * Description: Handles MongoDB connection with Mongoose
 * Path: ./src/config/database.ts
 */

import mongoose from 'mongoose';
import config from './environment';
import logger from '../utils/logger';

class Database {
  private static instance: Database;

  private constructor() {}

  static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  async connect(): Promise<void> {
    try {
      mongoose.set('strictQuery', false);

      await mongoose.connect(config.mongodb.uri, {
        dbName: config.mongodb.dbName,
      });

      logger.info('MongoDB connected successfully', {
        host: mongoose.connection.host,
        database: config.mongodb.dbName,
      });

      // Handle connection events
      mongoose.connection.on('error', (error) => {
        logger.error('MongoDB connection error', error);
      });

      mongoose.connection.on('disconnected', () => {
        logger.warn('MongoDB disconnected. Attempting to reconnect...');
      });

      mongoose.connection.on('reconnected', () => {
        logger.info('MongoDB reconnected successfully');
      });

      process.on('SIGINT', async () => {
        await this.disconnect();
        process.exit(0);
      });

    } catch (error) {
      logger.error('Failed to connect to MongoDB', error);
      process.exit(1);
    }
  }

  async disconnect(): Promise<void> {
    try {
      await mongoose.connection.close();
      logger.info('MongoDB connection closed');
    } catch (error) {
      logger.error('Error closing MongoDB connection', error);
    }
  }

  getConnection() {
    return mongoose.connection;
  }
}

export default Database.getInstance();
