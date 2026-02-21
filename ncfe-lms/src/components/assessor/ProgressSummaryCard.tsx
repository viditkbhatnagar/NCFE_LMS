'use client';

interface ProgressSummaryCardProps {
  metCount: number;
  totalCount: number;
}

export default function ProgressSummaryCard({
  metCount,
  totalCount,
}: ProgressSummaryCardProps) {
  const pct =
    totalCount > 0 ? Math.round((metCount / totalCount) * 100) : 0;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-5 flex items-center gap-5">
      <div className="flex-1">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
          Course Progress
        </p>
        <p className="text-sm text-gray-700">
          <span className="font-semibold text-gray-900">{metCount}</span> of{' '}
          <span className="font-semibold text-gray-900">{totalCount}</span>{' '}
          criteria completed
        </p>
        <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-brand-500 rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <span className="shrink-0 px-3 py-1 rounded-full text-sm font-semibold bg-brand-50 text-brand-700">
        {pct}% Complete
      </span>
    </div>
  );
}
