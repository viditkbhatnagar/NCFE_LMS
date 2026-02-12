'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';

interface Submission {
  _id: string;
  unitId: { _id: string; unitReference: string; title: string };
  status: string;
  attemptNumber: number;
  submittedAt: string;
  evidenceIds: string[];
}

export default function StudentSubmissionsPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    async function fetchSubmissions() {
      try {
        const res = await fetch('/api/submissions');
        const data = await res.json();
        if (data.success) setSubmissions(data.data);
      } catch (error) {
        console.error('Failed to fetch submissions:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchSubmissions();
  }, []);

  const statusConfig: Record<string, { variant: 'default' | 'success' | 'warning' | 'error' | 'info'; label: string }> = {
    submitted: { variant: 'info', label: 'Submitted' },
    under_review: { variant: 'warning', label: 'Under Review' },
    assessed: { variant: 'success', label: 'Assessed' },
    resubmission_required: { variant: 'error', label: 'Resubmission Required' },
  };

  const filtered = filter === 'all' ? submissions : submissions.filter((s) => s.status === filter);

  return (
    <div>
      <h1 className="text-2xl font-bold text-text-primary mb-6">My Submissions</h1>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {[
          { key: 'all', label: 'All' },
          { key: 'submitted', label: 'Submitted' },
          { key: 'under_review', label: 'Under Review' },
          { key: 'assessed', label: 'Assessed' },
          { key: 'resubmission_required', label: 'Resubmission' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-3 py-1.5 text-sm rounded-[6px] font-medium transition-colors ${
              filter === tab.key
                ? 'bg-primary text-white'
                : 'bg-white text-text-secondary border border-border hover:bg-background'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-gray-200 rounded-[8px] animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <div className="text-center py-8 text-text-secondary">
            {filter === 'all' ? 'No submissions yet. Submit evidence from your portfolio.' : `No ${filter.replace('_', ' ')} submissions.`}
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((sub) => (
            <Link key={sub._id} href={`/submissions/${sub._id}/feedback`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-text-primary">
                        {sub.unitId?.unitReference || 'Unit'}: {sub.unitId?.title || 'Unknown'}
                      </span>
                      <Badge variant={statusConfig[sub.status]?.variant || 'default'}>
                        {statusConfig[sub.status]?.label || sub.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-text-muted">
                      <span>Attempt #{sub.attemptNumber}</span>
                      <span>{sub.evidenceIds?.length || 0} evidence items</span>
                      <span>{new Date(sub.submittedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
