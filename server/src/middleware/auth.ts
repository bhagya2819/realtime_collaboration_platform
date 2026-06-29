import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, TokenPayload } from '../utils/jwt';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ message: 'No token provided' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = verifyAccessToken(token);
    req.userId = decoded.userId;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
};
