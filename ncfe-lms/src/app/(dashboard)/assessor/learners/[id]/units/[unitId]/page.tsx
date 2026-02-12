'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';

interface Evidence {
  _id: string;
  fileName: string;
  fileType: string;
  label: string;
  status: string;
  uploadedAt: string;
  mappings: { acNumber: string; assessmentCriteriaId: string }[];
}

interface Submission {
  _id: string;
  status: string;
  attemptNumber: number;
  submittedAt: string;
  evidenceIds: string[];
}

interface UnitDetail {
  _id: string;
  unitReference: string;
  title: string;
  description: string;
}

export default function AssessorLearnerUnitPage() {
  const { id: learnerId, unitId } = useParams();
  const [unit, setUnit] = useState<UnitDetail | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [unitRes, subsRes] = await Promise.all([
          fetch(`/api/units/${unitId}`),
          fetch(`/api/submissions?learnerId=${learnerId}&unitId=${unitId}`),
        ]);
        const unitData = await unitRes.json();
        const subsData = await subsRes.json();

        if (unitData.success) setUnit(unitData.data);
        if (subsData.success) setSubmissions(subsData.data);
      } catch (error) {
        console.error('Failed to fetch unit data:', error);
      } finally {
        setLoading(false);
      }
    }
    if (learnerId && unitId) fetchData();
  }, [learnerId, unitId]);

  const statusConfig: Record<string, { variant: 'default' | 'success' | 'warning' | 'error' | 'info'; label: string }> = {
    submitted: { variant: 'info', label: 'Submitted' },
    under_review: { variant: 'warning', label: 'Under Review' },
    assessed: { variant: 'success', label: 'Assessed' },
    resubmission_required: { variant: 'error', label: 'Resubmission Required' },
  };

  if (loading) {
    return (
      <div>
        <div className="h-8 bg-gray-200 rounded w-1/3 animate-pulse mb-6" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-gray-200 rounded-[8px] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <Link href={`/assessor/learners/${learnerId}`} className="text-sm text-primary hover:underline mb-4 inline-block">
        &larr; Back to Learner
      </Link>

      <h1 className="text-2xl font-bold text-text-primary mb-2">
        {unit?.unitReference}: {unit?.title}
      </h1>
      <p className="text-sm text-text-secondary mb-6">{unit?.description}</p>

      <h2 className="text-lg font-semibold text-text-primary mb-4">Submissions</h2>

      {submissions.length === 0 ? (
        <Card>
          <div className="text-center py-8 text-text-secondary">
            No submissions for this unit yet.
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {submissions.map((sub) => (
            <Link key={sub._id} href={`/assessor/submissions/${sub._id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-text-primary">Attempt #{sub.attemptNumber}</span>
                      <Badge variant={statusConfig[sub.status]?.variant || 'default'}>
                        {statusConfig[sub.status]?.label || sub.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-text-muted">
                      <span>{sub.evidenceIds?.length || 0} evidence items</span>
                      <span>Submitted {new Date(sub.submittedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {sub.status === 'submitted' && (
                      <Link
                        href={`/assessor/submissions/${sub._id}/assess`}
                        className="px-3 py-1.5 bg-primary text-white text-xs font-medium rounded-[6px] hover:bg-primary/90"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Assess
                      </Link>
                    )}
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
