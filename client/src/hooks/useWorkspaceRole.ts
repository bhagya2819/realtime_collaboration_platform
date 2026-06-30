import { useState, useEffect } from 'react';
import api from '../services/api';

export const useWorkspaceRole = (workspaceId: string | undefined) => {
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) { setLoading(false); return; }

    (async () => {
      try {
        const { data } = await api.get(`/workspaces/${workspaceId}`);
        const ws = data.workspace;
        if (!ws) { setRole(null); setLoading(false); return; }

        const { data: meData } = await api.get('/auth/me');
        const myId = meData?.user?.id;

        if (typeof ws.owner === 'object' && ws.owner._id && myId === ws.owner._id) {
          setRole('admin');
          setLoading(false);
          return;
        }

        const member = ws.members?.find(
          (m: any) => {
            const uid = typeof m.user === 'object' ? m.user._id : m.user;
            return uid === myId;
          }
        );

        setRole(member?.role || null);
      } catch {} finally { setLoading(false); }
    })();
  }, [workspaceId]);

  const canEdit = role === 'admin' || role === 'editor';
  const isAdmin = role === 'admin';

  return { role, loading, canEdit, isAdmin };
};
