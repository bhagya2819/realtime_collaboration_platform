import session from 'express-session';
import { RedisStore } from 'connect-redis';
import { getRedis } from './redis';
import { env } from './env';

export const createSessionMiddleware = () => {
  const redisStore = new RedisStore({
    client: getRedis() as any,
    prefix: 'sess:',
  });

  return session({
    store: redisStore,
    secret: env.JWT_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: 'lax',
    },
  });
};
