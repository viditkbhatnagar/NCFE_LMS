'use client';

import type { PortfolioEvidence } from '@/types';

const FILE_ICONS: Record<string, { icon: string; color: string }> = {
  pdf: { icon: 'PDF', color: '#DC2626' },
  doc: { icon: 'DOC', color: '#2563EB' },
  docx: { icon: 'DOC', color: '#2563EB' },
  jpg: { icon: 'IMG', color: '#059669' },
  jpeg: { icon: 'IMG', color: '#059669' },
  png: { icon: 'IMG', color: '#059669' },
  mp4: { icon: 'VID', color: '#7C3AED' },
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  submitted: 'bg-brand-50 text-brand-700',
  assessed: 'bg-green-50 text-green-700',
};

function getFileExt(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() || '';
}

interface EvidenceCardProps {
  evidence: PortfolioEvidence;
  onPreview?: (evidence: PortfolioEvidence) => void;
  onDownload?: (evidence: PortfolioEvidence) => void;
  onRename?: (evidence: PortfolioEvidence) => void;
  onDelete?: (evidence: PortfolioEvidence) => void;
}

export default function EvidenceCard({
  evidence,
  onPreview,
  onDownload,
  onRename,
  onDelete,
}: EvidenceCardProps) {
  const ext = getFileExt(evidence.fileName);
  const fileIcon = FILE_ICONS[ext] || {
    icon: ext.toUpperCase() || 'FILE',
    color: '#6B7280',
  };

  const date = new Date(evidence.uploadedAt);
  const dateStr = !isNaN(date.getTime())
    ? date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '-';

  const showActions = onPreview || onDownload || onRename || onDelete;
  const canModify = evidence.status !== 'assessed';

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow relative group">
      {/* File type badge */}
      <div
        className="w-10 h-10 rounded-md flex items-center justify-center mb-3 text-xs font-bold text-white"
        style={{ backgroundColor: fileIcon.color }}
      >
        {fileIcon.icon}
      </div>

      <p
        className="text-sm font-semibold text-gray-900 truncate mb-0.5"
        title={evidence.label}
      >
        {evidence.label}
      </p>
      <p
        className="text-xs text-gray-500 truncate mb-3"
        title={evidence.fileName}
      >
        {evidence.fileName}
      </p>

      {/* Status badge */}
      <span
        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium capitalize mb-2 ${
          STATUS_COLORS[evidence.status] || STATUS_COLORS.draft
        }`}
      >
        {evidence.status}
      </span>

      <div className="text-xs text-gray-400 mt-1 space-y-0.5">
        <span>{dateStr}</span>
        {evidence.unitId && (
          <p className="truncate" title={evidence.unitId.title}>
            {evidence.unitId.unitReference} &middot; {evidence.unitId.title}
          </p>
        )}
      </div>

      {/* Action bar */}
      {showActions && (
        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-1 py-1.5 bg-white/90 border-t border-gray-200 rounded-b-lg opacity-0 group-hover:opacity-100 transition-opacity">
          {onPreview && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPreview(evidence);
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-gray-600 hover:text-primary rounded hover:bg-gray-100 transition-colors"
              title="Preview"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Preview
            </button>
          )}
          {onDownload && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDownload(evidence);
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-gray-600 hover:text-primary rounded hover:bg-gray-100 transition-colors"
              title="Download"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download
            </button>
          )}
          {onRename && canModify && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRename(evidence);
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-gray-600 hover:text-primary rounded hover:bg-gray-100 transition-colors"
              title="Rename"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Rename
            </button>
          )}
          {onDelete && canModify && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(evidence);
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-500 hover:text-red-700 rounded hover:bg-red-50 transition-colors"
              title="Delete"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}
