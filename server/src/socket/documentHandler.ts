import { Socket } from 'socket.io';
import { io } from './index';
import { CommentModel, NotificationModel, User } from '../models';
import {
  getOrCreateYDoc,
  joinDocument,
  leaveDocument,
  applyUpdate,
  getFullState,
  setLastEditor,
} from './yDocManager';

interface DocumentRoomState {
  users: Map<string, { userId: string; cursor?: { position: number; selection?: any }; typing: boolean }>;
}

const documentRooms = new Map<string, DocumentRoomState>();

const getRoomState = (documentId: string): DocumentRoomState => {
  if (!documentRooms.has(documentId)) {
    documentRooms.set(documentId, { users: new Map() });
  }
  return documentRooms.get(documentId)!;
};

const parseMentions = (text: string): string[] => {
  const matches = text.match(/@\[([^\]]+)\]\(([^)]+)\)/g);
  if (!matches) return [];
  return matches.map((m) => {
    const idMatch = m.match(/\(([^)]+)\)/);
    return idMatch ? idMatch[1] : '';
  }).filter(Boolean);
};

export const handleDocumentEvents = (socket: Socket, userId: string): void => {
  socket.on('join-document', async ({ documentId }: { documentId: string }) => {
    socket.join(documentId);
    joinDocument(documentId);

    // Presence setup
    const state = getRoomState(documentId);
    state.users.set(socket.id, { userId, typing: false });

    socket.to(documentId).emit('user-joined', {
      documentId,
      userId,
      socketId: socket.id,
    });

    socket.emit('presence-update', {
      documentId,
      users: Array.from(state.users.entries()).map(([sid, u]) => ({ socketId: sid, ...u })),
    });

    // Yjs: get or create Y.Doc and send full state to joining client
    try {
      const ydoc = await getOrCreateYDoc(documentId);
      const fullState = getFullState(documentId); // synchronously reads encoded state
      if (fullState) {
        // Socket.IO handles Uint8Array/Buffer binary data natively
        socket.emit('yjs-sync-full', {
          documentId,
          state: Buffer.from(fullState),
        });
      }

      // Listen for Yjs incremental updates from this client
      socket.on('yjs-update', (data: { documentId: string; update: Uint8Array }) => {
        if (data.documentId !== documentId) return;

        const update = new Uint8Array(data.update);
        applyUpdate(documentId, update);
        setLastEditor(documentId, userId);

        // Broadcast to other clients in the room
        socket.to(documentId).emit('yjs-update', {
          documentId,
          update: Buffer.from(update),
          userId,
        });
      });
    } catch (err) {
      console.error(`Failed to init Y.Doc for ${documentId}:`, err);
      socket.emit('yjs-error', { message: 'Failed to initialize collaboration' });
    }
  });

  socket.on('leave-document', async ({ documentId }: { documentId: string }) => {
    socket.leave(documentId);

    // Clean up presence
    const state = documentRooms.get(documentId);
    if (state) {
      state.users.delete(socket.id);
      if (state.users.size === 0) {
        documentRooms.delete(documentId);
      }
    }

    socket.to(documentId).emit('user-left', { documentId, userId, socketId: socket.id });

    // Clean up Y.Doc (persist + destroy if last user)
    await leaveDocument(documentId);
  });

  socket.on('cursor-update', ({ documentId, position, selection }: { documentId: string; position: number; selection?: any }) => {
    const state = documentRooms.get(documentId);
    if (state) {
      const user = state.users.get(socket.id);
      if (user) {
        user.cursor = { position, selection };
      }
    }

    socket.to(documentId).emit('cursor-updated', {
      documentId,
      userId,
      socketId: socket.id,
      position,
      selection,
    });
  });

  socket.on('add-comment', async ({ documentId, comment }: { documentId: string; comment: { text: string; selectionReference?: any; threadParent?: string } }) => {
    try {
      const mentionIds = parseMentions(comment.text);

      const newComment = await CommentModel.create({
        document: documentId as any,
        user: userId as any,
        text: comment.text,
        selectionReference: comment.selectionReference,
        threadParent: comment.threadParent || undefined,
        mentions: mentionIds as any[],
      } as any);

      await newComment.populate('user', 'name email');

      const actor = await User.findById(userId).select('name');

      for (const mentionId of mentionIds) {
        await NotificationModel.create({
          recipient: mentionId,
          actor: userId,
          type: 'mention',
          message: `${actor?.name || 'Someone'} mentioned you in a comment`,
          targetType: 'document',
          targetId: documentId,
        });

        io.to(`user:${mentionId}`).emit('notification', {
          type: 'mention',
          message: `${actor?.name || 'Someone'} mentioned you in a comment`,
          targetType: 'document',
          targetId: documentId,
          notificationId: newComment._id,
        });
      }

      io.to(documentId).emit('new-comment', {
        documentId,
        comment: newComment,
      });
    } catch (err) {
      socket.emit('comment-error', { message: 'Failed to add comment' });
    }
  });

  socket.on('disconnect', async () => {
    const cleanupDocs: string[] = [];

    documentRooms.forEach((state, documentId) => {
      if (state.users.has(socket.id)) {
        state.users.delete(socket.id);
        socket.to(documentId).emit('user-left', { documentId, userId, socketId: socket.id });
        if (state.users.size === 0) {
          documentRooms.delete(documentId);
          cleanupDocs.push(documentId);
        }
      }
    });

    // Clean up Y.Docs for rooms where this was the last user
    await Promise.all(cleanupDocs.map((docId) => leaveDocument(docId)));
  });
};
