'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import ProgressRing from '@/components/ui/ProgressRing';

interface Enrolment {
  _id: string;
  status: string;
  qualificationId: {
    _id: string;
    title: string;
    level: number;
    code: string;
    awardingBody: string;
  };
}

export default function CoursesPage() {
  const [enrolments, setEnrolments] = useState<Enrolment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchEnrolments() {
      try {
        const res = await fetch('/api/enrolments');
        const data = await res.json();
        if (data.success) {
          setEnrolments(data.data);
        }
      } catch (error) {
        console.error('Failed to fetch enrolments:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchEnrolments();
  }, []);

  const statusBadge = (status: string) => {
    const variants: Record<string, 'success' | 'warning' | 'info' | 'default'> = {
      enrolled: 'info',
      in_progress: 'warning',
      completed: 'success',
      withdrawn: 'default',
    };
    const labels: Record<string, string> = {
      enrolled: 'Enrolled',
      in_progress: 'In Progress',
      completed: 'Completed',
      withdrawn: 'Withdrawn',
    };
    return <Badge variant={variants[status] || 'default'}>{labels[status] || status}</Badge>;
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">My Courses</h1>
        <p className="text-text-secondary mt-1">View your enrolled qualifications</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-card rounded-[8px] border border-border p-6 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-4" />
              <div className="h-3 bg-gray-200 rounded w-1/2 mb-2" />
              <div className="h-3 bg-gray-200 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : enrolments.length === 0 ? (
        <Card>
          <div className="text-center py-8">
            <svg className="w-12 h-12 text-text-muted mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <h3 className="text-lg font-medium text-text-primary mb-1">No courses yet</h3>
            <p className="text-text-secondary">You haven&apos;t been enrolled in any qualifications yet.</p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {enrolments.map((enrolment) => (
            <Link key={enrolment._id} href={`/courses/${enrolment.qualificationId._id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <div className="flex items-start justify-between mb-4">
                  {statusBadge(enrolment.status)}
                  <ProgressRing value={0} size={44} strokeWidth={3} />
                </div>
                <h3 className="text-base font-semibold text-text-primary mb-2 line-clamp-2">
                  {enrolment.qualificationId.title}
                </h3>
                <div className="space-y-1">
                  <p className="text-sm text-text-secondary">
                    Level {enrolment.qualificationId.level}
                  </p>
                  <p className="text-xs text-text-muted">
                    {enrolment.qualificationId.code} &middot; {enrolment.qualificationId.awardingBody}
                  </p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
