'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAssessorCourse } from '@/contexts/AssessorCourseContext';
import MemberCard from '@/components/assessor/MemberCard';
import LearnerGroup from '@/components/assessor/LearnerGroup';
import type { MembersData } from '@/types';
import ListStateBoundary, {
  DefaultListSkeleton,
  EmptyState,
} from '@/components/common/ListStateBoundary';

export default function MembersPage() {
  const { qualification } = useAssessorCourse();
  const [data, setData] = useState<MembersData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v2/members/${qualification._id}`);
      if (!res.ok) {
        setError('The server returned an error. Please try again.');
        return;
      }
      const json = await res.json();
      if (json.success) setData(json.data);
      else setError(json.error || 'Failed to load members.');
    } catch (err) {
      console.error('Error fetching members:', err);
      setError('Network error. Check your connection and retry.');
    } finally {
      setLoading(false);
    }
  }, [qualification._id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalLearners = data?.learnerGroups.reduce(
    (sum, g) => sum + g.learners.length,
    0
  ) ?? 0;
  const isEmpty = !data || ((data.teamMembers?.length ?? 0) === 0 && totalLearners === 0);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Members</h1>
        <p className="text-sm text-gray-400 mt-0.5">Your allocated members as ASSESSOR</p>
      </div>

      <ListStateBoundary
        loading={loading}
        error={error}
        isEmpty={isEmpty}
        onRetry={fetchData}
        skeleton={<DefaultListSkeleton rows={4} />}
        emptyContent={
          <EmptyState
            title="No members yet"
            description="Once an admin enrols students or assigns assessors to this qualification, they'll appear here."
          />
        }
      >

      {/* Team Members card */}
      <div className="bg-white rounded-[8px] border border-gray-200">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
          <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <h3 className="font-semibold text-gray-900">
            Team Members
          </h3>
          {data && (
            <span className="text-sm font-normal text-gray-400">
              ({data.teamMembers.length})
            </span>
          )}
        </div>
        <div className="divide-y divide-gray-100">
          {(data?.teamMembers ?? []).length === 0 && (
            <p className="px-5 py-8 text-sm text-gray-400 text-center">
              No team members found
            </p>
          )}
          {(data?.teamMembers ?? []).map((member) => (
            <MemberCard key={member._id} member={member} />
          ))}
        </div>
      </div>

      {/* Learner Groups */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h3 className="font-semibold text-gray-900">Learner Groups</h3>
          <span className="text-sm font-normal text-gray-400">
            ({totalLearners} learner{totalLearners !== 1 ? 's' : ''})
          </span>
        </div>
        <div className="space-y-3">
          {(data?.learnerGroups ?? []).length === 0 && (
            <p className="text-sm text-gray-400">No learners assigned</p>
          )}
          {(data?.learnerGroups ?? []).map((group, idx) => (
            <LearnerGroup
              key={group.cohortId || `unassigned-${idx}`}
              group={group}
            />
          ))}
        </div>
      </div>
      </ListStateBoundary>
    </div>
  );
}
