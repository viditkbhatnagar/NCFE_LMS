'use client';

import { useAssessorCourse } from '@/contexts/AssessorCourseContext';

export default function AssessorSubHeader() {
  const { qualification, enrollments, currentEnrollmentId, setCurrentEnrollmentId, userRole } =
    useAssessorCourse();

  return (
    <div className="sticky top-0 z-30 bg-white border-b border-gray-200 h-12 flex items-center px-4 gap-3">
      {/* Qualification breadcrumb */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className="text-gray-400">&#183;</span>
        <span className="text-sm font-medium text-gray-700 truncate">
          {qualification?.title || 'Loading...'}
        </span>
      </div>

      {/* Learner dropdown — assessors only */}
      {userRole !== 'student' && (
        <div className="relative shrink-0">
          <select
            value={currentEnrollmentId || ''}
            onChange={(e) => setCurrentEnrollmentId(e.target.value)}
            className="appearance-none bg-gray-100 border border-gray-200 rounded-[6px] px-3 py-1.5 pr-8 text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">All Learners</option>
            {enrollments.map((enrollment) => (
              <option key={enrollment._id} value={enrollment._id}>
                {enrollment.userId?.name || 'Unknown learner'}
              </option>
            ))}
          </select>
          <svg
            className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      )}
    </div>
  );
}
