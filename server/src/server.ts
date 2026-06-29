import { createApp } from './app';
import { initSocket } from './socket';
import { connectDB } from './config/db';
import { env } from './config/env';

export const start = async () => {
  await connectDB();
  const app = createApp();

  const httpServer = app.listen(env.PORT, () => {
    console.log(`Server running on port ${env.PORT} in ${env.NODE_ENV} mode`);
  });

  initSocket(httpServer);
};

start();
