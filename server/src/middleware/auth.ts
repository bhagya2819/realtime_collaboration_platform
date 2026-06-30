import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, TokenPayload } from '../utils/jwt';
import { getRedis } from '../config/redis';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

const isBlacklisted = async (token: string): Promise<boolean> => {
  try {
    const redis = getRedis();
    const result = await redis.get(`bl:${token}`);
    return result !== null;
  } catch {
    return false;
  }
};

export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ message: 'No token provided' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = verifyAccessToken(token);
    const blacklisted = await isBlacklisted(token);
    if (blacklisted) {
      res.status(401).json({ message: 'Token has been revoked' });
      return;
    }
    req.userId = decoded.userId;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
};
