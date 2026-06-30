import React, { useState, useEffect } from 'react';
import { diffLines } from 'diff';
import type { Change } from 'diff';
import api from '../../services/api';

interface Props {
  documentId: string;
  versionId: string;
  onClose: () => void;
}

export const VersionDiffViewer: React.FC<Props> = ({ documentId, versionId, onClose }) => {
  const [diffs, setDiffs] = useState<Change[]>([]);
  const [versionLabel, setVersionLabel] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data: vData } = await api.get(`/documents/${documentId}/versions/${versionId}`);
        const version = vData.version;

        const { data: dData } = await api.get(`/documents/${documentId}`);
        const current = dData.document;

        setVersionLabel(`v${version.snapshotNumber}`);

        const oldText = JSON.stringify(version.content, null, 2);
        const newText = JSON.stringify(current.content, null, 2);
        setDiffs(diffLines(oldText, newText));
      } catch {} finally {
        setLoading(false);
      }
    })();
  }, [documentId, versionId]);

  if (loading) {
    return <div className="p-4 text-xs text-gray-400">Loading diff...</div>;
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b flex items-center justify-between">
        <h3 className="font-semibold text-sm">
          Diff: <span className="text-blue-600">{versionLabel}</span> → current
        </h3>
        <button onClick={onClose} className="text-xs text-gray-500 hover:text-gray-700">
          Close
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 font-mono text-xs">
        {diffs.length === 0 ? (
          <p className="text-gray-400">No changes detected</p>
        ) : (
          diffs.map((part, i) => {
            const bg = part.added
              ? 'bg-green-50 text-green-800'
              : part.removed
                ? 'bg-red-50 text-red-800'
                : 'text-gray-600';

            return (
              <pre key={i} className={`whitespace-pre-wrap break-all px-2 py-0.5 ${bg}`}>
                {part.added ? '+ ' : part.removed ? '- ' : '  '}
                {part.value.trimEnd()}
              </pre>
            );
          })
        )}
      </div>
    </div>
  );
};
