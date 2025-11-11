/**
 * File: Application logger utility
 * Description: Provides structured logging for the application
 * Path: ./src/utils/logger.ts
 */

import fs from 'fs';
import path from 'path';

enum LogLevel {
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  DEBUG = 'DEBUG',
}

class Logger {
  private logDir: string;

  constructor() {
    this.logDir = path.join(process.cwd(), 'logs');
    this.ensureLogDirectory();
  }

  private ensureLogDirectory() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private formatMessage(level: LogLevel, message: string, meta?: any): string {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? `\n${JSON.stringify(meta, null, 2)}` : '';
    return `[${timestamp}] [${level}] ${message}${metaStr}`;
  }

  private writeToFile(level: LogLevel, message: string) {
    const fileName = `${level.toLowerCase()}-${new Date().toISOString().split('T')[0]}.log`;
    const filePath = path.join(this.logDir, fileName);
    fs.appendFileSync(filePath, message + '\n');
  }

  info(message: string, meta?: any) {
    const formatted = this.formatMessage(LogLevel.INFO, message, meta);
    console.log('\x1b[36m%s\x1b[0m', formatted);
    this.writeToFile(LogLevel.INFO, formatted);
  }

  warn(message: string, meta?: any) {
    const formatted = this.formatMessage(LogLevel.WARN, message, meta);
    console.warn('\x1b[33m%s\x1b[0m', formatted);
    this.writeToFile(LogLevel.WARN, formatted);
  }

  error(message: string, meta?: any) {
    const formatted = this.formatMessage(LogLevel.ERROR, message, meta);
    console.error('\x1b[31m%s\x1b[0m', formatted);
    this.writeToFile(LogLevel.ERROR, formatted);
  }

  debug(message: string, meta?: any) {
    if (process.env.NODE_ENV === 'development') {
      const formatted = this.formatMessage(LogLevel.DEBUG, message, meta);
      console.debug('\x1b[35m%s\x1b[0m', formatted);
      this.writeToFile(LogLevel.DEBUG, formatted);
    }
  }
}

export default new Logger();
