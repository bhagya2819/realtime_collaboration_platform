import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import type { Document } from '../types';
import { useWorkspaceRole } from '../hooks/useWorkspaceRole';
import { ActivityFeed } from '../components/workspace/ActivityFeed';
import { MemberList } from '../components/workspace/MemberList';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';

export const DocumentListPage: React.FC = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [workspaceName, setWorkspaceName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [error, setError] = useState('');
  const [showActivity, setShowActivity] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const { canEdit, isAdmin } = useWorkspaceRole(workspaceId);

  const fetchDocuments = async () => {
    try {
      const { data } = await api.get(`/workspaces/${workspaceId}/documents`);
      setDocuments(data.documents);
    } catch {
      setError('Failed to load documents');
    }
  };

  const fetchWorkspace = async () => {
    try {
      const { data } = await api.get(`/workspaces/${workspaceId}`);
      setWorkspaceName(data.workspace.name);
    } catch {}
  };

  const fetchInviteCode = async () => {
    try {
      const { data } = await api.post(`/workspaces/${workspaceId}/invite`);
      setInviteCode(data.inviteCode);
    } catch {}
  };

  useEffect(() => {
    fetchDocuments();
    fetchWorkspace();
  }, [workspaceId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post(`/workspaces/${workspaceId}/documents`, { title: newTitle });
      setNewTitle('');
      setShowCreate(false);
      fetchDocuments();
    } catch {
      setError('Failed to create document');
    }
  };

  const handleShowInvite = async () => {
    await fetchInviteCode();
    setShowInvite(true);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/workspaces')}
              className="text-gray-500 hover:text-gray-700"
            >
              ← Back
            </button>
            <h1 className="text-xl font-bold">{workspaceName || 'Documents'}</h1>
          </div>
          <Button variant="secondary" onClick={handleShowInvite}>
            Invite Members
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {error && (
          <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4">{error}</div>
        )}

        {showInvite && inviteCode && (
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg mb-6 flex items-center justify-between">
            <div>
              <span className="text-sm text-blue-700 font-medium">Invite Code: </span>
              <span className="text-lg font-mono tracking-wider">{inviteCode}</span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  navigator.clipboard.writeText(inviteCode);
                }}
              >
                Copy
              </Button>
              <Button variant="secondary" onClick={() => setShowInvite(false)}>
                ×
              </Button>
            </div>
          </div>
        )}

        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold">Documents</h2>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setShowActivity(!showActivity)}>
              {showActivity ? 'Hide Activity' : 'Activity'}
            </Button>
            <Button variant="secondary" onClick={() => setShowMembers(!showMembers)}>
              {showMembers ? 'Hide Members' : 'Members'}
            </Button>
            {canEdit && <Button onClick={() => setShowCreate(true)}>+ New Document</Button>}
          </div>
        </div>

        {showActivity && workspaceId && (
          <div className="bg-white rounded-lg shadow mb-6 max-h-64 overflow-y-auto">
            <ActivityFeed workspaceId={workspaceId} />
          </div>
        )}

        {showMembers && workspaceId && (
          <div className="bg-white rounded-lg shadow p-3 mb-6 max-h-80 overflow-y-auto">
            <h3 className="text-sm font-semibold mb-3">Workspace Members</h3>
            <MemberList workspaceId={workspaceId} isAdmin={isAdmin} />
          </div>
        )}

        {showCreate && canEdit && (
          <div className="bg-white p-4 rounded-lg shadow mb-6">
            <form onSubmit={handleCreate} className="flex gap-3 items-end">
              <div className="flex-1">
                <Input
                  label="Document Title"
                  id="document-title"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  required
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit">Create</Button>
                <Button variant="secondary" type="button" onClick={() => setShowCreate(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        )}

        {documents.length === 0 ? (
          <p className="text-gray-500">No documents yet. Create one to get started.</p>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => (
              <div
                key={doc._id}
                onClick={() => navigate(`/documents/${doc._id}`)}
                className="bg-white p-4 rounded-lg shadow hover:shadow-md cursor-pointer transition-shadow flex justify-between items-center"
              >
                <div>
                  <h3 className="font-medium">{doc.title}</h3>
                  <p className="text-xs text-gray-400 mt-1">
                    Last edited{' '}
                    {new Date(doc.updatedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};
