import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import api from '../services/api';
import { Document } from '../types';

const useDebounce = (fn: Function, delay: number) => {
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const debouncedFn = useCallback(
    (...args: any[]) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        fn(...args);
      }, delay);
    },
    [fn, delay]
  );

  return debouncedFn;
};

export const DocumentPage: React.FC = () => {
  const { documentId } = useParams<{ documentId: string }>();
  const navigate = useNavigate();
  const [document, setDocument] = useState<Document | null>(null);
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Start typing...' }),
    ],
    content: '',
    onUpdate: ({ editor }) => {
      handleContentChange(editor.getJSON());
    },
  });

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
        setError('Failed to load document');
      }
    };
    fetchDocument();
  }, [documentId, editor]);

  const saveDocument = async (updates: { title?: string; content?: object }) => {
    try {
      setSaving(true);
      await api.patch(`/documents/${documentId}`, updates);
    } catch {
      setError('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const saveTitle = useCallback(
    (newTitle: string) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        saveDocument({ title: newTitle });
      }, 3000);
    },
    [documentId]
  );

  const handleContentChange = useCallback(
    (content: object) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        saveDocument({ content });
      }, 3000);
    },
    [documentId]
  );

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex justify-between items-center">
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
          <span className="text-xs text-gray-400">
            {saving ? 'Saving...' : 'Saved'}
          </span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg p-8 min-h-[70vh]">
          <EditorContent editor={editor} className="prose max-w-none" />
        </div>
      </main>
    </div>
  );
};
