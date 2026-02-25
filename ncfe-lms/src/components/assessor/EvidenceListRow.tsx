'use client';

import type { PortfolioEvidence } from '@/types';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  submitted: 'bg-brand-50 text-brand-700',
  assessed: 'bg-green-50 text-green-700',
};

function formatBytes(bytes: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface EvidenceListRowProps {
  evidence: PortfolioEvidence;
  onPreview?: (evidence: PortfolioEvidence) => void;
  onDownload?: (evidence: PortfolioEvidence) => void;
  onRename?: (evidence: PortfolioEvidence) => void;
  onDelete?: (evidence: PortfolioEvidence) => void;
}

export default function EvidenceListRow({
  evidence,
  onPreview,
  onDownload,
  onRename,
  onDelete,
}: EvidenceListRowProps) {
  const canModify = evidence.status !== 'assessed';
  const date = new Date(evidence.uploadedAt);
  const dateStr = date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return (
    <tr className="hover:bg-gray-50 border-b border-gray-100">
      <td className="py-3 px-4 max-w-[200px]">
        <p className="text-sm font-medium text-gray-900 truncate">
          {evidence.label}
        </p>
        <p className="text-xs text-gray-400 truncate">{evidence.fileName}</p>
      </td>
      <td className="py-3 px-4 text-sm text-gray-600 max-w-[180px] truncate">
        {evidence.unitId ? (
          `${evidence.unitId.unitReference} · ${evidence.unitId.title}`
        ) : (
          <span className="text-gray-300">&mdash;</span>
        )}
      </td>
      <td className="py-3 px-4">
        <span
          className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
            STATUS_COLORS[evidence.status] || STATUS_COLORS.draft
          }`}
        >
          {evidence.status}
        </span>
      </td>
      <td className="py-3 px-4 text-sm text-gray-500 whitespace-nowrap">
        {dateStr}
      </td>
      <td className="py-3 px-4 text-sm text-gray-400 whitespace-nowrap">
        {formatBytes(evidence.fileSize)}
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-1">
          {onPreview && (
            <button
              onClick={() => onPreview(evidence)}
              className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-primary"
              title="Preview"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </button>
          )}
          {onDownload && (
            <button
              onClick={() => onDownload(evidence)}
              className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-primary"
              title="Download"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
          )}
          {onRename && canModify && (
            <button
              onClick={() => onRename(evidence)}
              className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-primary"
              title="Rename"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          )}
          {onDelete && canModify && (
            <button
              onClick={() => onDelete(evidence)}
              className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-600"
              title="Delete"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
