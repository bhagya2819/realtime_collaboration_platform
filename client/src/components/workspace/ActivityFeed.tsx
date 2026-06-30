import React, { useState, useEffect } from 'react';
import api from '../../services/api';

interface Activity {
  _id: string;
  user: { name: string; email: string };
  action: string;
  targetType: string;
  createdAt: string;
  metadata?: Record<string, any>;
}

interface Props {
  workspaceId: string;
}

const ACTION_LABELS: Record<string, string> = {
  'document.created': 'created a document',
  'document.edited': 'edited a document',
  'comment.added': 'added a comment',
  'member.invited': 'generated an invite',
  'member.joined': 'joined the workspace',
  'role.changed': 'changed a member role',
  'version.restored': 'restored a version',
  'workspace.updated': 'updated the workspace',
};

export const ActivityFeed: React.FC<Props> = ({ workspaceId }) => {
  const [activities, setActivities] = useState<Activity[]>([]);

  const fetchActivities = async () => {
    try {
      const { data } = await api.get(`/workspaces/${workspaceId}/activity`);
      setActivities(data.activities);
    } catch {}
  };

  useEffect(() => {
    fetchActivities();
  }, [workspaceId]);

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b">
        <h3 className="font-semibold text-sm">Activity</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {activities.length === 0 && (
          <p className="text-gray-400 text-xs text-center py-4">No activity yet</p>
        )}

        {activities.map((a) => (
          <div key={a._id} className="flex gap-2 text-xs">
            <div className="w-2 h-2 rounded-full bg-blue-400 mt-1 shrink-0" />
            <div>
              <span className="font-medium">{a.user.name}</span>{' '}
              <span className="text-gray-600">{ACTION_LABELS[a.action] || a.action}</span>
              <div className="text-gray-400 text-[10px]">
                {new Date(a.createdAt).toLocaleDateString()}{' '}
                {new Date(a.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
