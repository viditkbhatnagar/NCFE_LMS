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
  submitted: 'bg-blue-50 text-blue-700',
  assessed: 'bg-green-50 text-green-700',
};

function getFileExt(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() || '';
}

export default function EvidenceCard({
  evidence,
}: {
  evidence: PortfolioEvidence;
}) {
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

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
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
    </div>
  );
}
