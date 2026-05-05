'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import type { AssessorCourse, UserRole } from '@/types';
import ListStateBoundary, {
  DefaultListSkeleton,
  EmptyState,
} from '@/components/common/ListStateBoundary';

export default function CourseSelector() {
  const { data: session } = useSession();
  const userRole = (session?.user as { role?: UserRole } | undefined)?.role || 'student';
  const [courses, setCourses] = useState<AssessorCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCourses = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const endpoint = userRole === 'student'
        ? '/api/v2/student/courses'
        : '/api/v2/assessor/courses';
      const res = await fetch(endpoint);
      if (!res.ok) {
        setError('The server returned an error. Please try again.');
        return;
      }
      const json = await res.json();
      if (json.success) setCourses(json.data);
      else setError(json.error || 'Failed to load courses.');
    } catch (err) {
      console.error('Error fetching courses:', err);
      setError('Network error. Check your connection and retry.');
    } finally {
      setLoading(false);
    }
  }, [session, userRole]);

  useEffect(() => {
    if (session) fetchCourses();
  }, [session, fetchCourses]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">My Courses</h1>
      <p className="text-sm text-gray-400 mb-6">Select a course to view its dashboard</p>

      <ListStateBoundary
        loading={loading}
        error={error}
        isEmpty={courses.length === 0}
        onRetry={fetchCourses}
        skeleton={
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-[8px] p-5 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-16 mb-3" />
                <div className="h-5 bg-gray-200 rounded w-3/4 mb-2" />
                <div className="h-3 bg-gray-200 rounded w-1/3" />
              </div>
            ))}
          </div>
        }
        emptyContent={
          <EmptyState
            title={userRole === 'student' ? 'No courses enrolled' : 'No courses assigned'}
            description={
              userRole === 'student'
                ? "Contact your administrator to get enrolled in a qualification."
                : 'You have no courses assigned yet. An admin can assign you to a qualification.'
            }
          />
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map((course) => (
            <Link
            key={course._id}
            href={`/c/${course.slug}`}
            className="block bg-white border border-gray-200 rounded-[8px] p-5 hover:border-primary hover:shadow-sm transition-all group"
          >
            <div className="flex items-start justify-between mb-3">
              <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs font-semibold rounded-full">
                Level {course.level}
              </span>
              <svg
                className="w-4 h-4 text-gray-300 group-hover:text-primary transition-colors"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-primary transition-colors leading-snug">
              {course.title}
            </h3>
            <p className="text-xs text-gray-400 mb-3">{course.code}</p>
            {userRole !== 'student' && (
              <p className="text-sm text-gray-500">
                {course.learnerCount} learner{course.learnerCount !== 1 ? 's' : ''}
              </p>
            )}
          </Link>
          ))}
        </div>
      </ListStateBoundary>
    </div>
  );
}
