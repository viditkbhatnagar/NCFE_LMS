'use client';

import type { PortfolioEvidence } from '@/types';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  submitted: 'bg-blue-50 text-blue-700',
  assessed: 'bg-green-50 text-green-700',
};

function formatBytes(bytes: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function EvidenceListRow({
  evidence,
}: {
  evidence: PortfolioEvidence;
}) {
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
    </tr>
  );
}
