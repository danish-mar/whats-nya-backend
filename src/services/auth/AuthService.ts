/**
 * File: Auth Service
 * Description: Authentication business logic
 * Path: ./src/services/auth/AuthService.ts
 */

import User from '../../models/User';
import { IUserDocument } from '../../models/User';
import TokenService, { TokenPair } from './TokenService';
import logger from '../../utils/logger';
import { Types } from 'mongoose';

interface RegisterInput {
  email: string;
  password: string;
  name?: string;
}

interface LoginInput {
  email: string;
  password: string;
}

class AuthService {
  async register(input: RegisterInput): Promise<{ user: IUserDocument; tokens: TokenPair }> {
    const { email, password, name } = input;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    const user = await User.create({
      email,
      password,
      name,
    });

    const userId = (user._id as Types.ObjectId).toString();
    logger.info('New user registered', { userId, email: user.email });

    const tokens = TokenService.generateTokenPair(userId, user.email);

    return { user, tokens };
  }

  async login(input: LoginInput): Promise<{ user: IUserDocument; tokens: TokenPair }> {
    const { email, password } = input;

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      throw new Error('Invalid email or password');
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw new Error('Invalid email or password');
    }

    const userId = (user._id as Types.ObjectId).toString();
    logger.info('User logged in', { userId, email: user.email });

    const tokens = TokenService.generateTokenPair(userId, user.email);

    user.password = undefined as any;

    return { user, tokens };
  }

  async refreshToken(refreshToken: string): Promise<TokenPair> {
    const payload = TokenService.verifyToken(refreshToken);
    if (!payload) {
      throw new Error('Invalid or expired refresh token');
    }

    const user = await User.findById(payload.userId);
    if (!user) {
      throw new Error('User not found');
    }

    const userId = (user._id as Types.ObjectId).toString();
    const tokens = TokenService.generateTokenPair(userId, user.email);

    return tokens;
  }

  async getUserById(userId: string): Promise<IUserDocument | null> {
    return User.findById(userId);
  }

  async updateProfile(userId: string, updates: { name?: string }): Promise<IUserDocument | null> {
    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (user) {
      logger.info('User profile updated', { userId, updates });
    }

    return user;
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const user = await User.findById(userId).select('+password');
    if (!user) {
      throw new Error('User not found');
    }

    const isPasswordValid = await user.comparePassword(currentPassword);
    if (!isPasswordValid) {
      throw new Error('Current password is incorrect');
    }

    user.password = newPassword;
    await user.save();

    logger.info('User password changed', { userId });
  }
}

export default new AuthService();
