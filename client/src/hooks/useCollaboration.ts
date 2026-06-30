import { useEffect, useRef } from 'react';
import { Editor } from '@tiptap/core';
import { useSocket } from './useSocket';
import { usePresenceStore } from '../stores/presenceStore';

export const useCollaboration = (editor: Editor | null, documentId: string | undefined) => {
  const { emit, subscribe } = useSocket();
  const { addUser, removeUser, updateCursor, setUsers, setTypingUsers } = usePresenceStore((s) => s);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!documentId || !editor) return;

    emit('join-document', { documentId });

    const unsubChanges = subscribe('receive-changes', (data: any) => {
      if (data.documentId === documentId && data.changes?.content) {
        editor.commands.setContent(data.changes.content);
      }
    });

    const unsubPresence = subscribe('presence-update', (data: any) => {
      if (data.documentId === documentId) setUsers(data.documentId, data.users);
    });

    const unsubJoined = subscribe('user-joined', (data: any) => {
      if (data.documentId === documentId) {
        addUser(data.documentId, { socketId: data.socketId, userId: data.userId, typing: false });
      }
    });

    const unsubLeft = subscribe('user-left', (data: any) => {
      if (data.documentId === documentId) removeUser(data.documentId, data.socketId);
    });

    const unsubCursor = subscribe('cursor-updated', (data: any) => {
      if (data.documentId === documentId) {
        updateCursor(data.documentId, data.socketId, { position: data.position, selection: data.selection });
      }
    });

    const unsubTyping = subscribe('typing-users', (data: any) => {
      if (data.documentId === documentId) setTypingUsers(data.documentId, data.userIds);
    });

    return () => {
      emit('leave-document', { documentId });
      unsubChanges();
      unsubPresence();
      unsubJoined();
      unsubLeft();
      unsubCursor();
      unsubTyping();
    };
  }, [documentId, editor]);

  const sendCursor = (position: number, selection?: any) => {
    if (!documentId) return;
    emit('cursor-update', { documentId, position, selection });
  };

  const sendTypingStart = () => {
    if (!documentId) return;
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    emit('typing-start', { documentId });
    typingTimerRef.current = setTimeout(() => {
      emit('typing-stop', { documentId });
    }, 2000);
  };

  const syncContent = (content: object) => {
    if (!documentId) return;
    emit('send-changes', { documentId, changes: { content } });
  };

  return { sendCursor, sendTypingStart, syncContent };
};
