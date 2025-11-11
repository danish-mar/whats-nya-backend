/**
 * File: Environment configuration loader
 * Description: Loads and validates environment variables
 * Path: ./src/config/environment.ts
 */

import dotenv from 'dotenv';

dotenv.config();

interface EnvironmentConfig {
  nodeEnv: string;
  port: number;
  apiVersion: string;
  mongodb: {
    uri: string;
    dbName: string;
  };
  jwt: {
    secret: string;
    expiresIn: string;
    refreshExpiresIn: string;
  };
  whatsapp: {
    syncDays: number;
    maxSessionsPerUser: number;
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
  cors: {
    origin: string;
  };
}

const config: EnvironmentConfig = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  apiVersion: process.env.API_VERSION || 'v1',
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/nya-chat',
    dbName: process.env.MONGODB_DB_NAME || 'nya-chat',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'change-this-secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },
  whatsapp: {
    syncDays: parseInt(process.env.WA_SYNC_DAYS || '30', 10),
    maxSessionsPerUser: parseInt(process.env.WA_MAX_SESSIONS_PER_USER || '5', 10),
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  },
};

export default config;
