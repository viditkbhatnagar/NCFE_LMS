'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';

interface Evidence {
  _id: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  label: string;
  mappings: { assessmentCriteriaId: { acNumber: string } }[];
}

interface SubmissionDetail {
  _id: string;
  unitId: { _id: string; unitReference: string; title: string };
  learnerId: { _id: string; name: string; email: string };
  status: string;
  attemptNumber: number;
  submittedAt: string;
  evidenceIds: Evidence[];
}

export default function SubmissionDetailPage() {
  const params = useParams();
  const [submission, setSubmission] = useState<SubmissionDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSubmission() {
      try {
        const res = await fetch(`/api/submissions/${params.id}`);
        const data = await res.json();
        if (data.success) setSubmission(data.data);
      } catch (error) {
        console.error('Failed to fetch submission:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchSubmission();
  }, [params.id]);

  if (loading) return <div className="animate-pulse h-40 bg-gray-200 rounded-[8px]" />;
  if (!submission) return <Card><p className="text-center py-8 text-text-secondary">Submission not found</p></Card>;

  const statusConfig: Record<string, { variant: 'info' | 'warning' | 'success' | 'error'; label: string }> = {
    submitted: { variant: 'info', label: 'Submitted' },
    under_review: { variant: 'warning', label: 'Under Review' },
    assessed: { variant: 'success', label: 'Assessed' },
    resubmission_required: { variant: 'error', label: 'Resubmission Required' },
  };

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-text-muted mb-2">
        <Link href="/assessor/submissions" className="hover:text-primary">Submissions</Link>
        <span>/</span>
        <span className="text-text-secondary">Detail</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{submission.learnerId?.name}</h1>
          <p className="text-text-secondary">
            {submission.unitId?.unitReference} - {submission.unitId?.title}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant={statusConfig[submission.status]?.variant || 'info'}>
              {statusConfig[submission.status]?.label || submission.status}
            </Badge>
            <span className="text-xs text-text-muted">
              Attempt {submission.attemptNumber} &middot; Submitted {new Date(submission.submittedAt).toLocaleDateString()}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/assessor/submissions/${submission._id}/assess`}>
            <Button>Assess</Button>
          </Link>
          <Link href={`/assessor/submissions/${submission._id}/feedback`}>
            <Button variant="outline">Feedback</Button>
          </Link>
        </div>
      </div>

      {/* Evidence Files */}
      <Card>
        <h2 className="text-lg font-semibold text-text-primary mb-4">
          Evidence Files ({submission.evidenceIds?.length || 0})
        </h2>
        <div className="space-y-3">
          {(submission.evidenceIds || []).map((ev) => (
            <div key={ev._id} className="flex items-start gap-3 p-3 border border-border rounded-[6px]">
              <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center text-text-muted flex-shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-medium text-text-primary">{ev.label}</h4>
                <p className="text-xs text-text-muted">{ev.fileName}</p>
                {ev.mappings && ev.mappings.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {ev.mappings.map((m, i) => (
                      <span key={i} className="text-xs bg-primary-light text-primary px-1.5 py-0.5 rounded">
                        {m.assessmentCriteriaId?.acNumber}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <a
                href={ev.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:text-primary-dark"
              >
                View
              </a>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
