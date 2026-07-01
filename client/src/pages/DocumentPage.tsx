import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useEditor, EditorContent, ReactRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Mention from '@tiptap/extension-mention';
import Collaboration from '@tiptap/extension-collaboration';
import api from '../services/api';
import type { Document } from '../types';
import { useSocket } from '../hooks/useSocket';
import { useCollaboration } from '../hooks/useCollaboration';
import { useWorkspaceRole } from '../hooks/useWorkspaceRole';
import { usePresenceStore } from '../stores/presenceStore';
import { CommentPanel } from '../components/comments/CommentPanel';
import { VersionHistoryPanel } from '../components/version/VersionHistoryPanel';
import { MentionList } from '../components/editor/MentionList';

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
        const pos = currentView.coordsAtPos(Math.min(user.cursor!.position, currentView.state.doc.content.size));
        if (!pos) return null;
        return (
          <div key={user.socketId} className="absolute pointer-events-none z-10 transition-all duration-100" style={{ left: pos.left, top: pos.top }}>
            <div className="w-4 h-6" style={{ backgroundColor: getCursorColor(i) }} />
            <span className="text-white text-[10px] px-1 rounded whitespace-nowrap absolute -top-4 left-0" style={{ backgroundColor: getCursorColor(i) }}>
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
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'comments' | 'versions' | 'online'>('comments');
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const docRef = useRef<Document | null>(null);

  const { emit, subscribe } = useSocket();
  const { typingUsers } = usePresenceStore((s) => s);
  const workspaceId = docRef.current?.workspace as string | undefined;
  const { canEdit } = useWorkspaceRole(workspaceId);

  // Initialize Yjs collaboration — creates Y.Doc, sets up socket sync
  const { ydoc, sendCursor, sendTypingStart } = useCollaboration(documentId);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Start typing...' }),
      Mention.configure({
        HTMLAttributes: { class: 'text-blue-600 font-medium' },
        renderLabel: ({ node }) => `@${node.attrs.label}`,
        suggestion: {
          char: '@',
          items: async ({ query }: { query: string }) => {
            try {
              const { data } = await api.get('/workspaces');
              const workspaces = data.workspaces || [];
              const memberMap = new Map<string, { id: string; name: string; email: string }>();
              for (const ws of workspaces) {
                for (const member of ws.members || []) {
                  const u = typeof member.user === 'object' ? member.user : null;
                  if (u && !memberMap.has(u.id)) {
                    memberMap.set(u.id, u);
                  }
                }
              }
              return Array.from(memberMap.values())
                .filter((u) => u.name.toLowerCase().includes(query.toLowerCase()))
                .slice(0, 10);
            } catch {
              return [];
            }
          },
          render: () => {
            let component: ReactRenderer | null = null;
            let popup: HTMLElement | null = null;

            return {
              onStart: (props: any) => {
                component = new ReactRenderer(MentionList, {
                  props,
                  editor: props.editor,
                });
                popup = document.createElement('div');
                popup.className = 'absolute z-50';
                document.body.appendChild(popup);
                popup.appendChild(component.element);
              },
              onUpdate(props: any) {
                if (component) {
                  (component as ReactRenderer).updateProps(props);
                }
                if (popup && props.clientRect) {
                  const rect = props.clientRect();
                  if (rect) {
                    popup.style.position = 'absolute';
                    popup.style.left = `${rect.left + window.scrollX}px`;
                    popup.style.top = `${rect.bottom + window.scrollY}px`;
                  }
                }
              },
              onKeyDown(props: any) {
                if ((component as any)?.ref?.onKeyDown) {
                  return (component as any).ref.onKeyDown(props);
                }
                return false;
              },
              onExit() {
                if (popup) {
                  popup.remove();
                  popup = null;
                }
                if (component) {
                  component.destroy();
                  component = null;
                }
              },
            };
          },
        },
      }),
      // Wire TipTap Collaboration extension with Yjs Y.Doc
      Collaboration.configure({
        document: ydoc,
      }),
    ],
    content: '',
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(canEdit);
  }, [editor, canEdit]);

  // Wire cursor and typing indicator events to the editor
  useEffect(() => {
    if (!editor) return;

    editor.on('update', () => {
      sendTypingStart();
    });

    editor.on('selectionUpdate', () => {
      sendCursor(editor.state.selection.from, editor.state.selection.toJSON());
    });

    return () => {
      editor.off('update');
      editor.off('selectionUpdate');
    };
  }, [editor, sendCursor, sendTypingStart]);

  // Load document metadata (title, workspace info) via REST
  useEffect(() => {
    if (!documentId) return;
    (async () => {
      try {
        const { data } = await api.get(`/documents/${documentId}`);
        docRef.current = data.document;
        setTitle(data.document.title);
      } catch { navigate('/workspaces'); }
    })();
  }, [documentId]);

  const saveToDb = async (updates: { title?: string; content?: object }) => {
    try { setSaving(true); await api.patch(`/documents/${documentId}`, updates); } catch {}
    setSaving(false);
  };

  const saveTitle = useCallback((newTitle: string) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => saveToDb({ title: newTitle }), 3000);
  }, [documentId]);

  const docTypingUsers = typingUsers[documentId || ''] || [];
  const onlineUsers = usePresenceStore((s) => s.users[documentId || ''] || []);

  const typingText = docTypingUsers.length > 0
    ? `${docTypingUsers.map((u) => u.name).join(', ')} ${docTypingUsers.length === 1 ? 'is' : 'are'} typing...`
    : '';

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(`/workspaces/${docRef.current?.workspace}`)} className="text-gray-500 hover:text-gray-700">← Back</button>
            <input type="text" value={title} onChange={(e) => { setTitle(e.target.value); saveTitle(e.target.value); }}
              className="text-xl font-bold bg-transparent border-b-2 border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none px-1" />
          </div>
          <div className="flex items-center gap-4">
            {typingText && <span className="text-xs text-gray-400 italic">{typingText}</span>}
            <span className="text-xs text-gray-400">{saving ? 'Saving...' : 'Saved'}</span>
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

        <aside className="w-72 shrink-0 max-h-[80vh] overflow-hidden flex flex-col">
          <div className="bg-white rounded-lg shadow flex-1 flex flex-col">
            <div className="flex border-b text-xs">
              <button
                onClick={() => setSidebarTab('comments')}
                className={`flex-1 py-2 font-medium ${sidebarTab === 'comments' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'}`}
              >
                Comments
              </button>
              <button
                onClick={() => setSidebarTab('versions')}
                className={`flex-1 py-2 font-medium ${sidebarTab === 'versions' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'}`}
              >
                Versions
              </button>
              <button
                onClick={() => setSidebarTab('online')}
                className={`flex-1 py-2 font-medium ${sidebarTab === 'online' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'}`}
              >
                Online
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              {sidebarTab === 'comments' && <CommentPanel documentId={documentId!} editor={editor} />}
              {sidebarTab === 'versions' && <VersionHistoryPanel documentId={documentId!} />}
              {sidebarTab === 'online' && (
                <div className="p-3">
                  {onlineUsers.length === 0 ? <p className="text-xs text-gray-400">Only you</p> : (
                    <div className="space-y-2">
                      {onlineUsers.map((user, i) => (
                        <div key={user.socketId} className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: getCursorColor(i) }} />
                          <span className="text-sm truncate">{user.name || user.userId.slice(0, 8)}</span>
                          {user.typing && <span className="text-[10px] text-gray-400">typing</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};
