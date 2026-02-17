'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { AssessorCourse } from '@/types';

export default function CourseSelector() {
  const [courses, setCourses] = useState<AssessorCourse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCourses() {
      try {
        const res = await fetch('/api/v2/assessor/courses');
        const json = await res.json();
        if (json.success) setCourses(json.data);
      } catch (err) {
        console.error('Error fetching courses:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchCourses();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">My Courses</h1>
      <p className="text-sm text-gray-400 mb-6">Select a course to view its dashboard</p>

      {courses.length === 0 && (
        <div className="flex flex-col items-center py-16 text-gray-400">
          <svg
            className="w-16 h-16 mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
            />
          </svg>
          <p className="text-lg font-medium text-gray-500">No courses assigned</p>
          <p className="text-sm text-gray-400 mt-1">
            Contact your administrator to get enrolled
          </p>
        </div>
      )}

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
            <p className="text-sm text-gray-500">
              {course.learnerCount} learner{course.learnerCount !== 1 ? 's' : ''}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
