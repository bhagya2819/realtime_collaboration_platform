import { Socket } from 'socket.io';
import { io } from './index';
import { User } from '../models';

const typingUsers = new Map<string, Set<string>>();
const userNameCache = new Map<string, string>();

const getUserName = async (userId: string): Promise<string> => {
  const cached = userNameCache.get(userId);
  if (cached) return cached;

  try {
    const user = await User.findById(userId).select('name');
    const name = user?.name || userId.slice(0, 8);
    userNameCache.set(userId, name);
    return name;
  } catch {
    return userId.slice(0, 8);
  }
};

const getTypingUsersWithNames = async (documentId: string): Promise<Array<{ userId: string; name: string }>> => {
  const userIds = typingUsers.get(documentId);
  if (!userIds || userIds.size === 0) return [];

  const users = await Promise.all(
    Array.from(userIds).map(async (uid) => ({
      userId: uid,
      name: await getUserName(uid),
    }))
  );

  return users;
};

const broadcastTypingUsers = async (documentId: string): Promise<void> => {
  const users = await getTypingUsersWithNames(documentId);
  io.to(documentId).emit('typing-users', {
    documentId,
    users,
  });
};

export const handlePresenceEvents = (socket: Socket, userId: string): void => {
  socket.on('typing-start', async ({ documentId }: { documentId: string }) => {
    if (!typingUsers.has(documentId)) {
      typingUsers.set(documentId, new Set());
    }
    typingUsers.get(documentId)!.add(userId);

    await broadcastTypingUsers(documentId);
  });

  socket.on('typing-stop', async ({ documentId }: { documentId: string }) => {
    const users = typingUsers.get(documentId);
    if (users) {
      users.delete(userId);
      if (users.size === 0) {
        typingUsers.delete(documentId);
      }
    }

    await broadcastTypingUsers(documentId);
  });

  socket.on('disconnect', async () => {
    const cleanupDocs: string[] = [];

    typingUsers.forEach((users, documentId) => {
      if (users.has(userId)) {
        users.delete(userId);
        if (users.size === 0) {
          typingUsers.delete(documentId);
        } else {
          cleanupDocs.push(documentId);
        }
      }
    });

    await Promise.all(cleanupDocs.map((docId) => broadcastTypingUsers(docId)));
  });
};
