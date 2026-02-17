'use client';

import { TYPE_CONFIG, formatAssessmentDate } from '@/lib/assessment-utils';
import type { ProgressAssessment } from '@/types';

export default function ProgressAssessmentItem({
  assessment,
}: {
  assessment: ProgressAssessment;
}) {
  const config = assessment.assessmentKind
    ? TYPE_CONFIG[assessment.assessmentKind]
    : null;

  return (
    <div className="p-3 rounded-md border border-gray-200 bg-white">
      <p className="text-[10px] text-gray-400 mb-0.5">
        {formatAssessmentDate(assessment.date)}
      </p>
      <p className="text-sm font-medium text-gray-900 line-clamp-2 mb-1.5">
        {assessment.title || 'Untitled Assessment'}
      </p>
      {config && (
        <span
          className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium"
          style={{
            backgroundColor: `${config.color}18`,
            color: config.color,
          }}
        >
          {config.short} &middot; {config.label}
        </span>
      )}
    </div>
  );
}
