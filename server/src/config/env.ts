import dotenv from 'dotenv';

if (process.env.NODE_ENV !== 'test') {
  dotenv.config();
}

export const env = {
  get PORT() { return parseInt(process.env.PORT || '5000', 10); },
  get NODE_ENV() { return process.env.NODE_ENV || 'development'; },
  get MONGO_URI() { return process.env.MONGO_URI || 'mongodb://localhost:27017/collaboration-platform'; },
  get JWT_SECRET() { return process.env.JWT_SECRET || 'fallback_secret'; },
  get JWT_REFRESH_SECRET() { return process.env.JWT_REFRESH_SECRET || 'fallback_refresh_secret'; },
  get JWT_EXPIRE() { return process.env.JWT_EXPIRE || '15m'; },
  get JWT_REFRESH_EXPIRE() { return process.env.JWT_REFRESH_EXPIRE || '7d'; },
  get CLIENT_URL() { return process.env.CLIENT_URL || 'http://localhost:5173'; },
  get REDIS_URL() { return process.env.REDIS_URL || 'redis://localhost:6379'; },
};
