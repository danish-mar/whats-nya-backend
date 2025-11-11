/**
 * File: Token Service
 * Description: JWT token generation and validation
 * Path: ./src/services/auth/TokenService.ts
 */

import jwt, { SignOptions } from 'jsonwebtoken';
import config from '../../config/environment';
import { IUserPayload } from '../../types';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

class TokenService {
  generateAccessToken(payload: IUserPayload): string {
    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    } as SignOptions);
  }

  generateRefreshToken(payload: IUserPayload): string {
    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.refreshExpiresIn,
    } as SignOptions);
  }

  generateTokenPair(userId: string, email: string): TokenPair {
    const payload: IUserPayload = { userId, email };

    return {
      accessToken: this.generateAccessToken(payload),
      refreshToken: this.generateRefreshToken(payload),
    };
  }

  verifyToken(token: string): IUserPayload | null {
    try {
      const decoded = jwt.verify(token, config.jwt.secret) as IUserPayload;
      return decoded;
    } catch (error) {
      return null;
    }
  }

  decodeToken(token: string): IUserPayload | null {
    try {
      return jwt.decode(token) as IUserPayload;
    } catch (error) {
      return null;
    }
  }
}

export default new TokenService();
