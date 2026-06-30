import { getRedis } from '../config/redis';

const SESSION_PREFIX = 'session:';
const SESSION_TTL = 60 * 60 * 24 * 7; // 7 days

export const cacheSession = async (userId: string, token: string): Promise<void> => {
  try {
    const redis = getRedis();
    const key = `${SESSION_PREFIX}${userId}`;
    const existing = await redis.get(key);
    const tokens = existing ? JSON.parse(existing) : [];
    tokens.push({ token: token.substring(0, 20), createdAt: new Date().toISOString() });
    await redis.set(key, JSON.stringify(tokens.slice(-5)), 'EX', SESSION_TTL);
  } catch {}
};

export const removeSession = async (userId: string): Promise<void> => {
  try {
    const redis = getRedis();
    await redis.del(`${SESSION_PREFIX}${userId}`);
  } catch {}
};

export const getActiveSessions = async (userId: string): Promise<number> => {
  try {
    const redis = getRedis();
    const data = await redis.get(`${SESSION_PREFIX}${userId}`);
    if (!data) return 0;
    return JSON.parse(data).length;
  } catch {
    return 0;
  }
};
