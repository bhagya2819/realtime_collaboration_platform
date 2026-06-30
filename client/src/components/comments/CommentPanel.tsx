import React, { useState, useEffect } from 'react';
import type { Editor } from '@tiptap/core';
import api from '../../services/api';
import type { Comment } from '../../types';
import { Button } from '../common/Button';
import { useSocket } from '../../hooks/useSocket';

interface Props {
  documentId: string;
  editor: Editor | null;
}

const MENTION_REGEX = /@\[([^\]]+)\]\(([^)]+)\)/g;

const formatMention = (name: string, id: string) => `@[${name}](${id})`;

const parseMentions = (text: string): string[] => {
  const matches = text.match(MENTION_REGEX);
  if (!matches) return [];
  return matches.map((m) => {
    const idMatch = m.match(/\(([^)]+)\)/);
    return idMatch ? idMatch[1] : '';
  }).filter(Boolean);
};

const renderText = (text: string) => {
  const parts = text.split(MENTION_REGEX);
  const result: React.ReactNode[] = [];
  let i = 0;
  let match: RegExpExecArray | null;
  const regex = new RegExp(MENTION_REGEX);
  let lastIndex = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      result.push(<span key={`t-${i++}`}>{text.slice(lastIndex, match.index)}</span>);
    }
    result.push(
      <span key={`m-${i++}`} className="text-blue-600 font-medium">
        @{match[1]}
      </span>
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    result.push(<span key={`t-${i++}`}>{text.slice(lastIndex)}</span>);
  }
  return result;
};

export const CommentPanel: React.FC<Props> = ({ documentId, editor }) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [selectionRef, setSelectionRef] = useState<object>();
  const { subscribe } = useSocket();

  const fetchComments = async () => {
    try {
      const { data } = await api.get(`/documents/${documentId}/comments`);
      setComments(data.comments);
    } catch {}
  };

  useEffect(() => {
    fetchComments();
  }, [documentId]);

  useEffect(() => {
    const unsub1 = subscribe('new-comment', () => fetchComments());
    const unsub2 = subscribe('comment-resolved', () => fetchComments());
    return () => { unsub1(); unsub2(); };
  }, [documentId]);

  const handleAddComment = async () => {
    if (!text.trim()) return;
    try {
      const mentions = parseMentions(text);
      await api.post(`/documents/${documentId}/comments`, {
        text,
        mentions,
        selectionReference: selectionRef,
      });
      setText('');
      setSelectionRef(undefined);
      fetchComments();
    } catch {}
  };

  const handleAddReply = async (parentId: string) => {
    if (!replyText.trim()) return;
    try {
      const mentions = parseMentions(replyText);
      const ref = selectionRef;
      setSelectionRef(undefined);
      await api.post(`/documents/${documentId}/comments`, {
        text: replyText,
        threadParent: parentId,
        mentions,
        selectionReference: ref,
      });
      setReplyText('');
      setReplyTo(null);
      fetchComments();
    } catch {}
  };

  const handleResolve = async (commentId: string) => {
    await api.patch(`/comments/${commentId}/resolve`);
    fetchComments();
  };

  const rootComments = comments.filter((c) => !c.threadParent);
  const replies = (parentId: string) => comments.filter((c) => c.threadParent === parentId);

  return (
    <div className="h-full flex flex-col bg-white rounded-lg shadow">
      <div className="p-3 border-b">
        <h3 className="font-semibold text-sm">Comments</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {rootComments.length === 0 && (
          <p className="text-gray-400 text-xs text-center py-4">No comments yet</p>
        )}

        {rootComments.map((comment) => (
          <div
            key={comment._id}
            className={`border rounded-lg p-3 ${comment.resolved ? 'opacity-60 bg-gray-50' : ''}`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium">{comment.user.name}</span>
              <div className="flex items-center gap-2">
                {comment.resolved && (
                  <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                    Resolved
                  </span>
                )}
                <button
                  onClick={() => handleResolve(comment._id)}
                  className="text-[10px] text-gray-400 hover:text-gray-600"
                >
                  {comment.resolved ? 'Unresolve' : 'Resolve'}
                </button>
              </div>
            </div>
            <p className="text-sm text-gray-700">{renderText(comment.text)}</p>
            <button
              onClick={() => setReplyTo(replyTo === comment._id ? null : comment._id)}
              className="text-[10px] text-blue-500 mt-1 hover:underline"
            >
              Reply
            </button>

            {replies(comment._id).map((reply) => (
              <div key={reply._id} className="ml-4 mt-3 border-l-2 border-gray-200 pl-3">
                <span className="text-xs font-medium">{reply.user.name}</span>
                <p className="text-xs text-gray-600 mt-0.5">{renderText(reply.text)}</p>
              </div>
            ))}

            {replyTo === comment._id && (
              <div className="mt-2 ml-4">
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Write a reply... Use @name to mention"
                  className="w-full text-xs border rounded p-2 resize-none"
                  rows={2}
                />
                <div className="flex gap-2 mt-1">
                  <button
                    onClick={() => handleAddReply(comment._id)}
                    className="text-[10px] bg-blue-500 text-white px-2 py-1 rounded"
                  >
                    Reply
                  </button>
                  <button
                    onClick={() => setReplyTo(null)}
                    className="text-[10px] text-gray-500"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="p-3 border-t">
        {editor && (
          <button
            onClick={() => {
              const { from, to } = editor.state.selection;
              if (from !== to) {
                const slice = editor.state.selection.content();
                setSelectionRef({ from, to, text: slice.content.textBetween(0, slice.content.size, '\n') });
              }
            }}
            className="text-[10px] text-blue-500 hover:underline mb-1 block"
          >
            {selectionRef ? '✓ Selection captured' : '📎 Capture editor selection'}
          </button>
        )}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a comment... Use @name to mention"
          className="w-full text-sm border rounded p-2 resize-none"
          rows={3}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleAddComment();
            }
          }}
        />
        <Button onClick={handleAddComment} className="w-full mt-2 text-sm">
          Comment
        </Button>
      </div>
    </div>
  );
};
