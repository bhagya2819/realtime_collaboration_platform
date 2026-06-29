import { Socket } from 'socket.io';
import { io } from './index';

const typingUsers = new Map<string, Set<string>>();

export const handlePresenceEvents = (socket: Socket, userId: string): void => {
  socket.on('typing-start', ({ documentId }: { documentId: string }) => {
    if (!typingUsers.has(documentId)) {
      typingUsers.set(documentId, new Set());
    }
    typingUsers.get(documentId)!.add(userId);

    io.to(documentId).emit('typing-users', {
      documentId,
      userIds: Array.from(typingUsers.get(documentId)!),
    });
  });

  socket.on('typing-stop', ({ documentId }: { documentId: string }) => {
    const users = typingUsers.get(documentId);
    if (users) {
      users.delete(userId);
      if (users.size === 0) {
        typingUsers.delete(documentId);
      }
    }

    io.to(documentId).emit('typing-users', {
      documentId,
      userIds: users ? Array.from(users) : [],
    });
  });

  socket.on('disconnect', () => {
    typingUsers.forEach((users, documentId) => {
      if (users.has(userId)) {
        users.delete(userId);
        if (users.size === 0) {
          typingUsers.delete(documentId);
        } else {
          io.to(documentId).emit('typing-users', {
            documentId,
            userIds: Array.from(users),
          });
        }
      }
    });
  });
};
