'use client';

import type { ProgressUnit } from '@/types';

interface UnitCardProps {
  unit: ProgressUnit;
  isSelected: boolean;
  onClick: () => void;
}

export default function UnitCard({ unit, isSelected, onClick }: UnitCardProps) {
  const pct =
    unit.totalCount > 0
      ? Math.round((unit.metCount / unit.totalCount) * 100)
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
      <p className="text-[10px] font-mono text-gray-400 mb-0.5">
        {unit.unitReference}
      </p>
      <p className="text-sm font-medium text-gray-800 line-clamp-2 mb-2">
        {unit.title}
      </p>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-500">
          {unit.metCount}/{unit.totalCount} criteria
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
