import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';

export const InvitePage: React.FC = () => {
  const navigate = useNavigate();
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/workspaces/join', { inviteCode });
      navigate(`/workspaces/${data.workspace._id}`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to join workspace');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-2">Join Workspace</h1>
        <p className="text-gray-500 text-center mb-6">Enter the invite code to join</p>

        {error && (
          <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4">{error}</div>
        )}

        <form onSubmit={handleJoin}>
          <Input
            label="Invite Code"
            id="inviteCode"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            placeholder="e.g. ABC12345"
            required
          />
          <div className="flex gap-3 mt-4">
            <Button type="submit" isLoading={loading} className="flex-1">
              Join
            </Button>
            <Button type="button" variant="secondary" onClick={() => navigate('/workspaces')}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
