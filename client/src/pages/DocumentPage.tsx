import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import api from '../services/api';
import { Document } from '../types';
import { useSocket } from '../hooks/useSocket';
import { usePresenceStore } from '../stores/presenceStore';
import { CommentPanel } from '../components/comments/CommentPanel';

const CURSOR_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
];

const getCursorColor = (index: number) => CURSOR_COLORS[index % CURSOR_COLORS.length];

const RemoteCursors: React.FC<{ editor: ReturnType<typeof useEditor> }> = ({ editor }) => {
  const users = usePresenceStore((s) => s.users);
  const currentView = editor?.view;

  if (!currentView) return null;

  const flatUsers = Object.values(users).flat().filter((u) => u.cursor);

  return (
    <>
      {flatUsers.map((user, i) => {
        const pos = currentView.coordsAtPos(
          Math.min(user.cursor!.position, currentView.state.doc.content.size)
        );
        if (!pos) return null;
        return (
          <div
            key={user.socketId}
            className="absolute pointer-events-none z-10 transition-all duration-100"
            style={{ left: pos.left, top: pos.top }}
          >
            <div className="w-4 h-6" style={{ backgroundColor: getCursorColor(i) }} />
            <span
              className="text-white text-[10px] px-1 rounded whitespace-nowrap absolute -top-4 left-0"
              style={{ backgroundColor: getCursorColor(i) }}
            >
              {user.name || user.userId.slice(0, 6)}
            </span>
          </div>
        );
      })}
    </>
  );
};

export const DocumentPage: React.FC = () => {
  const { documentId } = useParams<{ documentId: string }>();
  const navigate = useNavigate();
  const [document, setDocument] = useState<Document | null>(null);
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const typingTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const { subscribe, emit } = useSocket();
  const {
    users,
    typingUserIds,
    addUser,
    removeUser,
    updateCursor,
    setTypingUsers: setStoreTyping,
    setUsers,
  } = usePresenceStore();

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Start typing...' }),
    ],
    content: '',
    onUpdate: ({ editor }) => {
      emit('send-changes', {
        documentId,
        changes: { content: editor.getJSON() },
      });
    },
    onSelectionUpdate: ({ editor }) => {
      emit('cursor-update', {
        documentId,
        position: editor.state.selection.from,
        selection: editor.state.selection.toJSON(),
      });
    },
  });

  useEffect(() => {
    if (!documentId) return;

    emit('join-document', { documentId });

    const unsubs = [
      subscribe('presence-update', (data: any) => {
        setUsers(data.documentId, data.users);
      }),
      subscribe('user-joined', (data: any) => {
        addUser(data.documentId, {
          socketId: data.socketId,
          userId: data.userId,
          typing: false,
        });
      }),
      subscribe('user-left', (data: any) => {
        removeUser(data.documentId, data.socketId);
      }),
      subscribe('cursor-updated', (data: any) => {
        updateCursor(data.documentId, data.socketId, {
          position: data.position,
          selection: data.selection,
        });
      }),
      subscribe('typing-users', (data: any) => {
        setStoreTyping(data.documentId, data.userIds);
      }),
      subscribe('receive-changes', (data: any) => {
        if (editor && data.changes?.content) {
          const { from, to } = editor.state.selection;
          editor.commands.setContent(data.changes.content);
          editor.commands.setTextSelection({ from, to });
        }
      }),
    ];

    return () => {
      emit('leave-document', { documentId });
      unsubs.forEach((unsub) => unsub());
    };
  }, [documentId, editor]);

  useEffect(() => {
    const fetchDocument = async () => {
      try {
        const { data } = await api.get(`/documents/${documentId}`);
        setDocument(data.document);
        setTitle(data.document.title);
        if (editor) {
          editor.commands.setContent(data.document.content || '');
        }
      } catch {
        navigate('/workspaces');
      }
    };
    fetchDocument();
  }, [documentId, editor]);

  const saveDocument = async (updates: { title?: string; content?: object }) => {
    try {
      setSaving(true);
      await api.patch(`/documents/${documentId}`, updates);
    } catch {}
    setSaving(false);
  };

  const saveTitle = useCallback(
    (newTitle: string) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => saveDocument({ title: newTitle }), 3000);
    },
    [documentId]
  );

  const docTypingUsers = typingUserIds[documentId || ''] || [];
  const onlineUsers = users[documentId || ''] || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(`/workspaces/${document?.workspace}`)}
              className="text-gray-500 hover:text-gray-700"
            >
              ← Back
            </button>
            <input
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                saveTitle(e.target.value);
              }}
              className="text-xl font-bold bg-transparent border-b-2 border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none px-1"
            />
          </div>
          <div className="flex items-center gap-4">
            {docTypingUsers.length > 0 && (
              <span className="text-xs text-gray-400 italic">
                {docTypingUsers.length === 1
                  ? 'Someone is typing...'
                  : `${docTypingUsers.length} people typing...`}
              </span>
            )}
            <span className="text-xs text-gray-400">
              {saving ? 'Saving...' : 'Saved'}
            </span>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto flex gap-4 px-4 py-8">
        <main className="flex-1 min-w-0">
          <div className="bg-white rounded-lg shadow-lg p-8 min-h-[70vh] relative">
            <RemoteCursors editor={editor} />
            <EditorContent editor={editor} className="prose max-w-none" />
          </div>
        </main>

        <aside className="w-72 shrink-0 max-h-[80vh] overflow-hidden">
          <CommentPanel documentId={documentId!} />
        </aside>

        <aside className="w-48 shrink-0">
          <div className="bg-white rounded-lg shadow p-4 sticky top-20">
            <h3 className="text-sm font-semibold text-gray-500 mb-3">Online</h3>
            {onlineUsers.length === 0 ? (
              <p className="text-xs text-gray-400">Only you</p>
            ) : (
              <div className="space-y-2">
                {onlineUsers.map((user, i) => (
                  <div key={user.socketId} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: getCursorColor(i) }}
                    />
                    <span className="text-sm truncate">
                      {user.name || user.userId.slice(0, 8)}
                    </span>
                    {user.typing && (
                      <span className="text-[10px] text-gray-400">typing</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};
