import { Socket } from 'socket.io';
import { io } from './index';
import { CommentModel, NotificationModel, User } from '../models';

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
  socket.on('join-document', ({ documentId }: { documentId: string }) => {
    socket.join(documentId);
    const state = getRoomState(documentId);
    state.users.set(socket.id, { userId, typing: false });

    socket.to(documentId).emit('user-joined', {
      documentId,
      userId,
      socketId: socket.id,
    });

    // Request sync from existing clients so new joiner gets current content
    socket.to(documentId).emit('request-sync', { documentId, requesterId: socket.id });

    socket.emit('presence-update', {
      documentId,
      users: Array.from(state.users.entries()).map(([sid, u]) => ({ socketId: sid, ...u })),
    });
  });

  socket.on('sync-content', ({ documentId, content, targetSocketId }: { documentId: string; content: any; targetSocketId: string }) => {
    io.to(targetSocketId).emit('receive-changes', {
      documentId,
      changes: { content },
      userId,
      socketId: socket.id,
    });
  });

  socket.on('leave-document', ({ documentId }: { documentId: string }) => {
    socket.leave(documentId);
    const state = documentRooms.get(documentId);
    if (state) {
      state.users.delete(socket.id);
      if (state.users.size === 0) {
        documentRooms.delete(documentId);
      }
    }

    socket.to(documentId).emit('user-left', { documentId, userId, socketId: socket.id });
  });

  socket.on('send-changes', ({ documentId, changes }: { documentId: string; changes: any }) => {
    socket.to(documentId).emit('receive-changes', {
      documentId,
      changes,
      userId,
      socketId: socket.id,
    });
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

  socket.on('disconnect', () => {
    documentRooms.forEach((state, documentId) => {
      if (state.users.has(socket.id)) {
        state.users.delete(socket.id);
        socket.to(documentId).emit('user-left', { documentId, userId, socketId: socket.id });
        if (state.users.size === 0) {
          documentRooms.delete(documentId);
        }
      }
    });
  });
};
