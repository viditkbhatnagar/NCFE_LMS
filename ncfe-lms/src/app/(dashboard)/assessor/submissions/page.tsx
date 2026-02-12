'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';

interface Submission {
  _id: string;
  unitId: { _id: string; unitReference: string; title: string };
  learnerId: { _id: string; name: string; email: string };
  status: string;
  attemptNumber: number;
  submittedAt: string;
  evidenceIds: string[];
}

export default function AssessorSubmissionsPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    async function fetchSubmissions() {
      try {
        const res = await fetch('/api/submissions');
        const data = await res.json();
        if (data.success) {
          setSubmissions(data.data);
        }
      } catch (error) {
        console.error('Failed to fetch submissions:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchSubmissions();
  }, []);

  const statusConfig: Record<string, { variant: 'info' | 'warning' | 'success' | 'error' | 'default'; label: string }> = {
    submitted: { variant: 'info', label: 'Submitted' },
    under_review: { variant: 'warning', label: 'Under Review' },
    assessed: { variant: 'success', label: 'Assessed' },
    resubmission_required: { variant: 'error', label: 'Resubmission Required' },
  };

  const filtered = filter === 'all'
    ? submissions
    : submissions.filter((s) => s.status === filter);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Submissions</h1>
        <p className="text-text-secondary mt-1">Review and assess learner submissions</p>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {[
          { value: 'all', label: 'All' },
          { value: 'submitted', label: 'Pending' },
          { value: 'under_review', label: 'Under Review' },
          { value: 'assessed', label: 'Assessed' },
          { value: 'resubmission_required', label: 'Resubmission' },
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-3 py-1.5 rounded-[6px] text-sm font-medium whitespace-nowrap transition-colors ${
              filter === f.value
                ? 'bg-primary text-white'
                : 'bg-white border border-border text-text-secondary hover:bg-background'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-gray-200 rounded-[8px] animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <div className="text-center py-8 text-text-secondary">No submissions found.</div>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((sub) => (
            <Link key={sub._id} href={`/assessor/submissions/${sub._id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer mb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-white font-medium text-sm">
                      {sub.learnerId?.name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-text-primary">
                        {sub.learnerId?.name || 'Unknown Learner'}
                      </h3>
                      <p className="text-xs text-text-secondary">
                        {sub.unitId?.unitReference} - {sub.unitId?.title}
                      </p>
                      <p className="text-xs text-text-muted">
                        Attempt {sub.attemptNumber} &middot; {sub.evidenceIds.length} evidence files &middot; {new Date(sub.submittedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={statusConfig[sub.status]?.variant || 'default'}>
                      {statusConfig[sub.status]?.label || sub.status}
                    </Badge>
                    <svg className="w-5 h-5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
