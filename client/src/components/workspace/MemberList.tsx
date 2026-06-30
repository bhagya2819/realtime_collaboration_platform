import React, { useState, useEffect } from 'react';
import api from '../../services/api';

interface Member {
  user: { _id: string; name: string; email: string };
  role: 'admin' | 'editor' | 'viewer';
  joinedAt: string;
}

interface Props {
  workspaceId: string;
  isAdmin: boolean;
}

export const MemberList: React.FC<Props> = ({ workspaceId, isAdmin }) => {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchMembers = async () => {
    try {
      const { data } = await api.get(`/workspaces/${workspaceId}`);
      setMembers(data.workspace.members || []);
    } catch {}
  };

  useEffect(() => {
    fetchMembers();
  }, [workspaceId]);

  const handleRoleChange = async (userId: string, role: string) => {
    setLoading(true);
    try {
      await api.patch(`/workspaces/${workspaceId}/members/${userId}`, { role });
      await fetchMembers();
    } catch {} finally {
      setLoading(false);
    }
  };

  if (members.length === 0) {
    return <p className="text-gray-400 text-xs text-center py-4">No members</p>;
  }

  return (
    <div className="space-y-2">
      {members.map((m) => (
        <div key={m.user._id} className="flex items-center justify-between bg-white border rounded-lg p-3">
          <div>
            <span className="text-sm font-medium">{m.user.name}</span>
            <span className="text-xs text-gray-400 block">{m.user.email}</span>
            <span className="text-[10px] text-gray-400">
              Joined {new Date(m.joinedAt).toLocaleDateString()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              m.role === 'admin' ? 'bg-purple-100 text-purple-700' :
              m.role === 'editor' ? 'bg-blue-100 text-blue-700' :
              'bg-gray-100 text-gray-600'
            }`}>
              {m.role}
            </span>
            {isAdmin && (
              <select
                value={m.role}
                onChange={(e) => handleRoleChange(m.user._id, e.target.value)}
                disabled={loading}
                className="text-xs border rounded px-1 py-0.5"
              >
                <option value="admin">Admin</option>
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
