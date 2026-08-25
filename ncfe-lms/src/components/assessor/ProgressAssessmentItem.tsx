'use client';

import { useParams, useRouter } from 'next/navigation';
import { useAssessorCourseOptional } from '@/contexts/AssessorCourseContext';
import { TYPE_CONFIG, formatAssessmentDate } from '@/lib/assessment-utils';
import type { ProgressAssessment } from '@/types';

export default function ProgressAssessmentItem({
  assessment,
}: {
  assessment: ProgressAssessment;
}) {
  const router = useRouter();
  const params = useParams();
  const course = useAssessorCourseOptional();
  const slug = params?.slug as string | undefined;

  const config = assessment.assessmentKind
    ? TYPE_CONFIG[assessment.assessmentKind]
    : null;

  // Open the assessment's detail panel. Carrying currentEnrollmentId keeps the
  // learner the user was already looking at selected on the way over.
  const open = () => {
    if (!slug) return;
    const qs = new URLSearchParams({ assessmentId: assessment._id });
    if (course?.currentEnrollmentId) qs.set('currentEnrollmentId', course.currentEnrollmentId);
    router.push(`/c/${slug}/assessment?${qs}`);
  };

  if (!slug) {
    // Rendered outside a course route — keep the read-only card rather than a
    // button that would navigate nowhere.
    return (
      <div className="p-3 rounded-md border border-gray-200 bg-white">
        <Body assessment={assessment} config={config} />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={open}
      aria-label={`Open assessment ${assessment.title || 'Untitled Assessment'}`}
      className="w-full text-left p-3 rounded-md border border-gray-200 bg-white cursor-pointer transition-colors hover:border-primary/40 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
    >
      <Body assessment={assessment} config={config} />
    </button>
  );
}

function Body({
  assessment,
  config,
}: {
  assessment: ProgressAssessment;
  config: (typeof TYPE_CONFIG)[keyof typeof TYPE_CONFIG] | null;
}) {
  return (
    <>
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
    </>
  );
}
