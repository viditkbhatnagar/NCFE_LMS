'use client';

import type { ProgressAC } from '@/types';

interface CriterionCardProps {
  ac: ProgressAC;
  isSelected: boolean;
  onClick: () => void;
}

export default function CriterionCard({
  ac,
  isSelected,
  onClick,
}: CriterionCardProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-md border transition-all flex items-start gap-2 ${
        isSelected
          ? 'border-brand-500 bg-brand-50 shadow-sm'
          : 'border-transparent hover:bg-gray-50 hover:border-gray-200'
      }`}
    >
      {/* Met/Not-met icon */}
      <div className="shrink-0 mt-0.5">
        {ac.isMet ? (
          <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center">
            <svg
              className="w-3 h-3 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        ) : (
          <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
        )}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold text-gray-400 uppercase mb-0.5">
          AC {ac.acNumber}
        </p>
        <p className="text-sm text-gray-800 line-clamp-3">{ac.description}</p>
      </div>
    </button>
  );
}
