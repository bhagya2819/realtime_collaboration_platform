import { useEffect, useRef } from 'react';
import * as Y from 'yjs';
import { Editor } from '@tiptap/core';
import { useSocket } from './useSocket';
import { usePresenceStore } from '../stores/presenceStore';

export const useCollaboration = (documentId: string | undefined) => {
  const ydocRef = useRef<Y.Doc>(new Y.Doc());
  const { emit, subscribe } = useSocket();
  const { addUser, removeUser, updateCursor, setUsers, setTypingUsers } = usePresenceStore((s) => s);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!documentId) return;

    const ydoc = ydocRef.current;

    // Tell server we're joining
    emit('join-document', { documentId });

    // Receive full Y.Doc state from server (on join)
    const unsubSyncFull = subscribe('yjs-sync-full', (data: any) => {
      if (data.documentId === documentId && data.state) {
        const state = data.state instanceof Uint8Array
          ? data.state
          : new Uint8Array(data.state);
        Y.applyUpdate(ydoc, state);
      }
    });

    // Receive incremental Y.Doc updates from other clients
    const unsubUpdate = subscribe('yjs-update', (data: any) => {
      if (data.documentId === documentId && data.update) {
        const update = data.update instanceof Uint8Array
          ? data.update
          : new Uint8Array(data.update);
        Y.applyUpdate(ydoc, update);
      }
    });

    // When local Y.Doc changes, send incremental update to server
    const updateHandler = (update: Uint8Array, origin: unknown) => {
      // Don't echo updates that came from the server
      if (origin === 'remote') return;
      if (update.byteLength === 0) return;
      emit('yjs-update', { documentId, update });
    };
    ydoc.on('update', updateHandler);

    // Presence subscriptions (unchanged)
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
      if (data.documentId === documentId) {
        setTypingUsers(data.documentId, data.users || []);
      }
    });

    return () => {
      ydoc.off('update', updateHandler);
      unsubSyncFull();
      unsubUpdate();
      unsubPresence();
      unsubJoined();
      unsubLeft();
      unsubCursor();
      unsubTyping();
      emit('leave-document', { documentId });
      // Don't destroy ydoc — the Collaboration extension still references it.
      // The Y.Doc will be garbage-collected when the component unmounts.
    };
  }, [documentId]);

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

  return { ydoc: ydocRef.current, sendCursor, sendTypingStart };
};
