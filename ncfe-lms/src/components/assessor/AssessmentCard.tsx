'use client';

import { TYPE_CONFIG, formatAssessmentDate } from '@/lib/assessment-utils';
import type { AssessmentListItem } from '@/types';

interface AssessmentCardProps {
  assessment: AssessmentListItem;
  isSelected: boolean;
  onClick: () => void;
}

export default function AssessmentCard({ assessment, isSelected, onClick }: AssessmentCardProps) {
  const isDraft = assessment.status === 'draft';
  const kind = assessment.assessmentKind;
  const config = kind ? TYPE_CONFIG[kind] : null;
  const learnerName = assessment.learnerId?.name || 'Unknown Learner';

  return (
    <button
      onClick={onClick}
      className={`w-full text-left bg-white rounded-[8px] shadow-sm transition-all hover:shadow-md ${
        isDraft ? 'border-2 border-dashed border-gray-300' : 'border border-gray-200'
      } ${isSelected ? 'ring-2 ring-brand-500 border-brand-500' : ''}`}
    >
      {/* Colored top bar */}
      {config && (
        <div
          className="h-1 rounded-t-[8px]"
          style={{ backgroundColor: config.color }}
        />
      )}

      <div className="p-4">
        {/* Date */}
        <p className="text-xs text-gray-500 mb-1">
          {formatAssessmentDate(assessment.date)}
        </p>

        {/* Title */}
        <h3 className="text-sm font-semibold text-gray-900 mb-2 line-clamp-2">
          {assessment.title || (isDraft ? 'Draft - Untitled Assessment' : 'Untitled Assessment')}
        </h3>

        {/* Learner */}
        <p className="text-xs text-gray-600 mb-3">{learnerName}</p>

        {/* Type badge */}
        {config && (
          <span
            className="inline-block px-2 py-0.5 rounded-full text-xs font-medium mb-3"
            style={{
              backgroundColor: `${config.color}15`,
              color: config.color,
            }}
          >
            {config.short} · {config.label}
          </span>
        )}

        {/* Draft badge when no kind is set */}
        {!config && isDraft && (
          <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium mb-3 bg-gray-100 text-gray-500">
            Draft
          </span>
        )}

        {/* Criteria dots */}
        {assessment.criteriaCount > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500">{assessment.criteriaCount} Criteria</span>
            <div className="flex gap-0.5">
              {Array.from({ length: Math.min(assessment.criteriaCount, 12) }).map((_, i) => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-gray-400"
                />
              ))}
              {assessment.criteriaCount > 12 && (
                <span className="text-xs text-gray-400">+{assessment.criteriaCount - 12}</span>
              )}
            </div>
          </div>
        )}
      </div>
    </button>
  );
}
