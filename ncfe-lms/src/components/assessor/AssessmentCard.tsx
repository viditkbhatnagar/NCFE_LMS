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
  const isModified = assessment.status === 'published_modified';
  const wasUpdated = (assessment.publishCount ?? 0) > 1;
  const kind = assessment.assessmentKind;
  const config = kind ? TYPE_CONFIG[kind] : null;
  const learnerName = assessment.learnerId?.name || 'Unknown Learner';

  return (
    <button
      onClick={onClick}
      className={`w-full text-left bg-white rounded-[8px] shadow-sm transition-all hover:shadow-md ${
        isDraft ? 'border-2 border-dashed border-gray-300' : isModified ? 'border border-amber-300' : 'border border-gray-200'
      } ${isSelected ? 'ring-2 ring-brand-500 border-brand-500' : ''}`}
    >
      {/* Colored top bar */}
      {config && (
        <div
          className="h-1 rounded-t-[8px]"
          style={{ backgroundColor: isModified ? '#f59e0b' : config.color }}
        />
      )}

      <div className="p-4">
        {/* Date + Updated badge */}
        <div className="flex items-center gap-2 mb-1">
          <p className="text-xs text-gray-500">
            {formatAssessmentDate(assessment.date)}
          </p>
          {wasUpdated && !isDraft && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-600">
              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Updated
            </span>
          )}
          {isModified && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-600">
              Modified
            </span>
          )}
        </div>

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
