import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import type { Workspace } from '../types';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { useAuthStore } from '../stores/authStore';

export const WorkspaceListPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');

  const fetchWorkspaces = async () => {
    try {
      const { data } = await api.get('/workspaces');
      setWorkspaces(data.workspaces);
    } catch {
      setError('Failed to load workspaces');
    }
  };

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/workspaces', { name: newName });
      setNewName('');
      setShowCreate(false);
      fetchWorkspaces();
    } catch {
      setError('Failed to create workspace');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="text-xl font-bold">My Workspaces</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user?.name}</span>
            <Button variant="secondary" onClick={handleLogout}>
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {error && (
          <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4">{error}</div>
        )}

        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold">Workspaces</h2>
          <Button onClick={() => setShowCreate(true)}>+ New Workspace</Button>
        </div>

        {showCreate && (
          <div className="bg-white p-4 rounded-lg shadow mb-6">
            <form onSubmit={handleCreate} className="flex gap-3 items-end">
              <div className="flex-1">
                <Input
                  label="Workspace Name"
                  id="workspace-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
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

        {workspaces.length === 0 ? (
          <p className="text-gray-500">No workspaces yet. Create one to get started.</p>
        ) : (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {workspaces.map((ws) => (
              <div
                key={ws._id}
                onClick={() => navigate(`/workspaces/${ws._id}`)}
                className="bg-white p-5 rounded-lg shadow hover:shadow-md cursor-pointer transition-shadow"
              >
                <h3 className="font-semibold text-lg mb-2">{ws.name}</h3>
                <p className="text-sm text-gray-500">
                  {ws.members?.length || 0} member{(ws.members?.length || 0) !== 1 ? 's' : ''}
                </p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};
