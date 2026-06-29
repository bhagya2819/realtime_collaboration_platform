import { useEffect, useRef } from 'react';
import { Editor } from '@tiptap/core';
import { useSocket } from './useSocket';

export const useCollaboration = (editor: Editor | null, documentId: string | undefined) => {
  const { emit, subscribe } = useSocket();
  const cursorTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const typingTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!documentId || !editor) return;

    emit('join-document', { documentId });

    const unsubChanges = subscribe('receive-changes', (data: any) => {
      if (data.changes) {
        const { from, to } = data.changes;
        if (from !== undefined && to !== undefined) {
          const docSize = editor.state.doc.content.size;
          const safeFrom = Math.min(from, docSize);
          const safeTo = Math.min(to, docSize);
          editor.chain().focus().deleteRange({ from: safeFrom, to: safeTo }).run();
        }
      }
    });

    const unsubUserJoined = subscribe('user-joined', () => {});
    const unsubUserLeft = subscribe('user-left', () => {});
    const unsubPresence = subscribe('presence-update', () => {});
    const unsubTyping = subscribe('typing-users', () => {});
    const unsubCursor = subscribe('cursor-updated', () => {});

    return () => {
      emit('leave-document', { documentId });
      unsubChanges();
      unsubUserJoined();
      unsubUserLeft();
      unsubPresence();
      unsubTyping();
      unsubCursor();
    };
  }, [documentId, editor]);

  const sendCursor = (position: number, selection?: any) => {
    if (!documentId) return;
    emit('cursor-update', { documentId, position, selection });
  };

  const sendTypingStart = () => {
    if (!documentId) return;
    emit('typing-start', { documentId });
  };

  const sendTypingStop = () => {
    if (!documentId) return;
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      emit('typing-stop', { documentId });
    }, 2000);
  };

  const syncContent = (content: object) => {
    if (!documentId || !editor) return;
    const json = editor.getJSON();
    const from = 0;
    const to = editor.state.doc.content.size;
    emit('send-changes', {
      documentId,
      changes: { from, to, content, json },
    });
  };

  return { sendCursor, sendTypingStart, sendTypingStop, syncContent };
};
