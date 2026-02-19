'use client';

import Link from 'next/link';
import type { DashboardAssessor, DashboardLearner, UserRole } from '@/types';

interface Props {
  assessors: DashboardAssessor[];
  learners: DashboardLearner[];
  slug: string;
  userRole?: UserRole;
}

export default function HomeLearnerCard({ assessors, learners, slug, userRole = 'assessor' }: Props) {
  const isStudent = userRole === 'student';
  return (
    <div className="bg-white rounded-[8px] border border-gray-200">
      {/* Card header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <h3 className="font-semibold text-gray-900">{isStudent ? 'Course Members' : 'My Learners'}</h3>
        </div>
        <Link
          href={`/c/${slug}/members`}
          className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
        >
          View all members
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* My Learners column */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            {isStudent ? 'Fellow Learners' : 'Learners'} ({learners.length})
          </p>
          {learners.length === 0 && (
            <p className="text-sm text-gray-400">{isStudent ? 'No fellow learners' : 'No learners assigned'}</p>
          )}
          <div className="space-y-2">
            {learners.slice(0, 6).map((learner) => {
              const initials = (learner.name || '')
                .trim()
                .split(/\s+/)
                .filter(Boolean)
                .map((n) => n.charAt(0))
                .join('')
                .toUpperCase()
                .slice(0, 2) || '?';
              return (
                <div key={learner.enrollmentId} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-medium shrink-0">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {learner.name}
                    </p>
                    <p className="text-xs text-gray-400 truncate">{learner.email}</p>
                  </div>
                </div>
              );
            })}
            {learners.length > 6 && (
              <p className="text-xs text-gray-400 pl-11">
                +{learners.length - 6} more
              </p>
            )}
          </div>
        </div>

        {/* Other Assessors column */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            {isStudent ? 'My Assessors' : 'Other Assessors'} ({assessors.length})
          </p>
          {assessors.length === 0 && (
            <p className="text-sm text-gray-400">{isStudent ? 'No assessors assigned' : 'No other assessors on this course'}</p>
          )}
          <div className="space-y-2">
            {assessors.slice(0, 6).map((assessor) => {
              const initials = (assessor.name || '')
                .trim()
                .split(/\s+/)
                .filter(Boolean)
                .map((n) => n.charAt(0))
                .join('')
                .toUpperCase()
                .slice(0, 2) || '?';
              return (
                <div key={assessor._id} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-400 flex items-center justify-center text-white text-xs font-medium shrink-0">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {assessor.name}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      {assessor.learnerCount} learner
                      {assessor.learnerCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              );
            })}
            {assessors.length > 6 && (
              <p className="text-xs text-gray-400 pl-11">
                +{assessors.length - 6} more
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
