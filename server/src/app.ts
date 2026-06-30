import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { env } from './config/env';
import { getRedis } from './config/redis';
import routes from './routes';
import { errorHandler } from './middleware/errorHandler';

export const createApp = () => {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
  app.use(morgan('dev'));
  app.use(express.json());

  if (env.NODE_ENV !== 'test') {
    const authLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 20,
      standardHeaders: true,
      legacyHeaders: false,
      message: { message: 'Too many requests, please try again later' },
      store: new RedisStore({
        sendCommand: (...args: string[]) => {
          const redis = getRedis();
          return (redis as any).call(...args) as Promise<any>;
        },
      }),
    });

    app.use('/api/auth/login', authLimiter);
    app.use('/api/auth/register', authLimiter);
    app.use('/api/auth/refresh', authLimiter);
  }

  app.use('/api', routes);

  app.use(errorHandler);

  return app;
};
