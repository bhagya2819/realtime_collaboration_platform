import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { verifyAccessToken } from '../utils/jwt';
import { env } from '../config/env';
import { getRedis } from '../config/redis';
import { handleDocumentEvents } from './documentHandler';
import { handlePresenceEvents } from './presenceHandler';

export let io: Server;

export const initSocket = (httpServer: HttpServer): Server => {
  io = new Server(httpServer, {
    cors: {
      origin: env.CLIENT_URL,
      methods: ['GET', 'POST'],
    },
  });

  // Setup Redis adapter for horizontal scaling (skips if Redis unavailable or in test)
  if (env.NODE_ENV !== 'test') {
    try {
      const pubClient = getRedis().duplicate();
      const subClient = getRedis().duplicate();
      io.adapter(createAdapter(pubClient, subClient));
    } catch {
      console.warn('Redis adapter not available for Socket.IO — running in single-instance mode');
    }
  }

  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const decoded = verifyAccessToken(token);
      (socket as any).userId = decoded.userId;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = (socket as any).userId;
    console.log(`User connected: ${userId} (socket: ${socket.id})`);

    // Join user-specific room for notifications
    socket.join(`user:${userId}`);

    handleDocumentEvents(socket, userId);
    handlePresenceEvents(socket, userId);

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${userId}`);
    });
  });

  return io;
};
