import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { User } from '../models';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  TokenPayload,
} from '../utils/jwt';
import { env } from '../config/env';
import { getRedis } from '../config/redis';
import { cacheSession, removeSession } from '../services/sessionCache';

const blacklistToken = async (token: string): Promise<void> => {
  try {
    const redis = getRedis();
    const decoded = jwt.decode(token) as { exp?: number } | null;
    if (decoded?.exp) {
      const ttl = Math.max(0, decoded.exp - Math.floor(Date.now() / 1000));
      if (ttl > 0) {
        await redis.set(`bl:${token}`, '1', 'EX', ttl);
      }
    }
  } catch {
    // Redis unavailable — skip blacklisting
  }
};

const isBlacklisted = async (token: string): Promise<boolean> => {
  try {
    const redis = getRedis();
    const result = await redis.get(`bl:${token}`);
    return result !== null;
  } catch {
    return false;
  }
};

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(409).json({ message: 'Email already registered' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, passwordHash });

    const tokenPayload = { userId: user._id.toString() };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    cacheSession(user._id.toString(), accessToken);

    res.status(201).json({
      user: { id: user._id, name: user.name, email: user.email },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    res.status(500).json({ message: 'Registration failed' });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      res.status(401).json({ message: 'Invalid email or password' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({ message: 'Invalid email or password' });
      return;
    }

    const tokenPayload = { userId: user._id.toString() };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    cacheSession(user._id.toString(), accessToken);

    res.json({
      user: { id: user._id, name: user.name, email: user.email },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    res.status(500).json({ message: 'Login failed' });
  }
};

export const getMe = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.userId).select('-passwordHash');
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    res.json({ user: { id: user._id, name: user.name, email: user.email } });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch user' });
  }
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const accessToken = authHeader.split(' ')[1];
      await blacklistToken(accessToken);
    }

    const { refreshToken } = req.body;
    if (refreshToken) {
      await blacklistToken(refreshToken);
    }

    removeSession(req.userId!);

    res.json({ message: 'Logged out successfully' });
  } catch {
    res.status(500).json({ message: 'Logout failed' });
  }
};

export const refresh = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      res.status(400).json({ message: 'Refresh token required' });
      return;
    }

    let payload: TokenPayload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      res.status(401).json({ message: 'Invalid or expired refresh token' });
      return;
    }

    const blacklisted = await isBlacklisted(refreshToken);
    if (blacklisted) {
      res.status(401).json({ message: 'Refresh token has been revoked' });
      return;
    }

    const user = await User.findById(payload.userId);
    if (!user) {
      res.status(401).json({ message: 'User not found' });
      return;
    }

    await blacklistToken(refreshToken);

    const tokenPayload = { userId: user._id.toString() };
    const newAccessToken = generateAccessToken(tokenPayload);
    const newRefreshToken = generateRefreshToken(tokenPayload);

    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch {
    res.status(500).json({ message: 'Token refresh failed' });
  }
};
