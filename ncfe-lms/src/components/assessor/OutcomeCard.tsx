'use client';

import type { ProgressLO } from '@/types';

interface OutcomeCardProps {
  lo: ProgressLO;
  isSelected: boolean;
  onClick: () => void;
}

export default function OutcomeCard({
  lo,
  isSelected,
  onClick,
}: OutcomeCardProps) {
  const pct =
    lo.totalCount > 0
      ? Math.round((lo.metCount / lo.totalCount) * 100)
      : 0;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-md border transition-all ${
        isSelected
          ? 'border-blue-500 bg-blue-50 shadow-sm'
          : 'border-transparent hover:bg-gray-50 hover:border-gray-200'
      }`}
    >
      <p className="text-[10px] font-semibold text-blue-500 uppercase mb-0.5">
        LO {lo.loNumber}
      </p>
      <p className="text-sm text-gray-800 line-clamp-2 mb-2">
        {lo.description}
      </p>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-500">
          {lo.metCount}/{lo.totalCount}
        </span>
        <span className="text-xs font-semibold text-gray-700">{pct}%</span>
      </div>
      <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-400 rounded-full"
          style={{ width: `${pct}%` }}
        />
      </div>
    </button>
  );
}
