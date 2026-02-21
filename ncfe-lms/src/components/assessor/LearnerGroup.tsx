'use client';

import { useState } from 'react';
import type { LearnerGroup as LearnerGroupType } from '@/types';

const STATUS_BADGE: Record<string, string> = {
  enrolled: 'bg-brand-100 text-brand-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
  withdrawn: 'bg-red-100 text-red-700',
};

interface Props {
  group: LearnerGroupType;
  defaultOpen?: boolean;
}

export default function LearnerGroup({ group, defaultOpen = true }: Props) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const label = group.cohortId || 'Unassigned';

  return (
    <div className="border border-gray-200 rounded-[8px] overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <span className="text-sm font-semibold text-gray-700">{label}</span>
          <span className="text-xs text-gray-400">
            ({group.learners.length} learner{group.learners.length !== 1 ? 's' : ''})
          </span>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Learner list */}
      {isOpen && (
        <div className="divide-y divide-gray-100">
          {group.learners.map((learner) => {
            const initials = (learner.name || '')
              .trim()
              .split(/\s+/)
              .filter(Boolean)
              .map((n) => n.charAt(0))
              .join('')
              .toUpperCase()
              .slice(0, 2) || '?';
            const statusClass =
              STATUS_BADGE[learner.status] ?? 'bg-gray-100 text-gray-700';

            return (
              <div
                key={learner.enrollmentId}
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-white font-medium text-xs shrink-0">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {learner.name}
                  </p>
                  <p className="text-xs text-gray-400 truncate">{learner.email}</p>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 capitalize ${statusClass}`}
                >
                  {learner.status.replace(/_/g, ' ')}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
