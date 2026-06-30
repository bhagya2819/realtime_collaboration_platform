import React, { useState, useEffect } from 'react';
import api from '../../services/api';

interface Version {
  _id: string;
  snapshotNumber: number;
  title: string;
  createdAt: string;
  savedBy: { name: string };
}

interface Props {
  documentId: string;
  onRestore?: () => void;
}

export const VersionHistoryPanel: React.FC<Props> = ({ documentId, onRestore }) => {
  const [versions, setVersions] = useState<Version[]>([]);
  const [restoring, setRestoring] = useState<string | null>(null);

  const fetchVersions = async () => {
    try {
      const { data } = await api.get(`/documents/${documentId}/versions`);
      setVersions(data.versions);
    } catch {}
  };

  useEffect(() => {
    fetchVersions();
  }, [documentId]);

  const handleRestore = async (versionId: string) => {
    setRestoring(versionId);
    try {
      await api.post(`/documents/${documentId}/restore/${versionId}`);
      onRestore?.();
    } catch {} finally {
      setRestoring(null);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b flex items-center justify-between">
        <h3 className="font-semibold text-sm">Version History</h3>
        <button onClick={fetchVersions} className="text-xs text-blue-500 hover:underline">
          Refresh
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {versions.length === 0 && (
          <p className="text-gray-400 text-xs text-center py-4">No versions yet</p>
        )}

        {versions.map((v) => (
          <div
            key={v._id}
            className="border rounded p-2 text-xs hover:bg-gray-50"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium text-gray-700">v{v.snapshotNumber}</span>
              <span className="text-gray-400">
                {new Date(v.createdAt).toLocaleDateString()}{' '}
                {new Date(v.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div className="text-gray-500 truncate">{v.title}</div>
            <div className="text-gray-400 text-[10px]">{v.savedBy?.name || 'Unknown'}</div>
            <button
              onClick={() => handleRestore(v._id)}
              disabled={restoring === v._id}
              className="mt-1 text-[10px] bg-blue-500 text-white px-2 py-0.5 rounded hover:bg-blue-600 disabled:opacity-50"
            >
              {restoring === v._id ? 'Restoring...' : 'Restore'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
