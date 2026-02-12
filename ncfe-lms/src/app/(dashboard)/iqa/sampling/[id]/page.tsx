'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';

interface SampleDetail {
  _id: string;
  iqaUserId: { _id: string; name: string };
  assessorId: { _id: string; name: string; email: string };
  learnerId: { _id: string; name: string; email: string };
  unitId: { _id: string; unitReference: string; title: string };
  qualificationId: { _id: string; title: string; code: string };
  assessmentMethodsSampled: string[];
  stage: string;
  status: string;
  createdAt: string;
}

export default function SampleDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [sample, setSample] = useState<SampleDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // IQA Decision form state
  const [decision, setDecision] = useState('');
  const [rationale, setRationale] = useState('');
  const [actionsForAssessor, setActionsForAssessor] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function fetchSample() {
      try {
        const res = await fetch(`/api/iqa/samples/${id}`);
        const data = await res.json();
        if (data.success) setSample(data.data);
      } catch (error) {
        console.error('Failed to fetch sample:', error);
      } finally {
        setLoading(false);
      }
    }
    if (id) fetchSample();
  }, [id]);

  async function handleDecision(e: React.FormEvent) {
    e.preventDefault();
    if (!decision || !rationale) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/iqa/decisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          iqaSampleId: id,
          decision,
          rationale,
          actionsForAssessor: actionsForAssessor || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        router.push('/iqa/decisions');
      }
    } catch (error) {
      console.error('Failed to submit decision:', error);
    } finally {
      setSubmitting(false);
    }
  }

  const stageConfig: Record<string, { variant: 'default' | 'info' | 'warning' | 'success'; label: string }> = {
    early: { variant: 'info', label: 'Early' },
    mid: { variant: 'warning', label: 'Mid' },
    late: { variant: 'success', label: 'Late' },
  };

  const statusConfig: Record<string, { variant: 'default' | 'info' | 'warning' | 'success'; label: string }> = {
    pending: { variant: 'warning', label: 'Pending' },
    reviewed: { variant: 'info', label: 'Reviewed' },
    completed: { variant: 'success', label: 'Completed' },
  };

  if (loading) {
    return (
      <div>
        <div className="h-8 bg-gray-200 rounded w-1/3 animate-pulse mb-6" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-gray-200 rounded-[8px] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!sample) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-text-primary mb-6">Sample Detail</h1>
        <Card>
          <div className="text-center py-8 text-text-secondary">Sample not found.</div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <Link href="/iqa/sampling" className="text-sm text-primary hover:underline mb-4 inline-block">
        &larr; Back to Sampling Plans
      </Link>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Sample Detail</h1>
        <div className="flex items-center gap-2">
          <Badge variant={stageConfig[sample.stage]?.variant || 'default'}>
            {stageConfig[sample.stage]?.label || sample.stage} stage
          </Badge>
          <Badge variant={statusConfig[sample.status]?.variant || 'default'}>
            {statusConfig[sample.status]?.label || sample.status}
          </Badge>
        </div>
      </div>

      {/* Sample Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card>
          <h3 className="text-sm font-semibold text-text-muted mb-3 uppercase tracking-wider">Qualification</h3>
          <p className="text-sm font-medium text-text-primary">{sample.qualificationId?.title}</p>
          <p className="text-xs text-text-secondary">{sample.qualificationId?.code}</p>
        </Card>
        <Card>
          <h3 className="text-sm font-semibold text-text-muted mb-3 uppercase tracking-wider">Unit</h3>
          <p className="text-sm font-medium text-text-primary">
            {sample.unitId?.unitReference}: {sample.unitId?.title}
          </p>
        </Card>
        <Card>
          <h3 className="text-sm font-semibold text-text-muted mb-3 uppercase tracking-wider">Assessor</h3>
          <p className="text-sm font-medium text-text-primary">{sample.assessorId?.name}</p>
          <p className="text-xs text-text-secondary">{sample.assessorId?.email}</p>
        </Card>
        <Card>
          <h3 className="text-sm font-semibold text-text-muted mb-3 uppercase tracking-wider">Learner</h3>
          <p className="text-sm font-medium text-text-primary">{sample.learnerId?.name}</p>
          <p className="text-xs text-text-secondary">{sample.learnerId?.email}</p>
        </Card>
      </div>

      {/* Assessment Methods */}
      {sample.assessmentMethodsSampled?.length > 0 && (
        <Card className="mb-6">
          <h3 className="text-sm font-semibold text-text-muted mb-3 uppercase tracking-wider">Assessment Methods Sampled</h3>
          <div className="flex flex-wrap gap-2">
            {sample.assessmentMethodsSampled.map((method, i) => (
              <Badge key={i} variant="default">{method}</Badge>
            ))}
          </div>
        </Card>
      )}

      {/* IQA Decision Form */}
      {sample.status !== 'completed' && (
        <Card>
          <h2 className="text-lg font-semibold text-text-primary mb-4">Record IQA Decision</h2>
          <form onSubmit={handleDecision} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">Decision *</label>
              <select
                value={decision}
                onChange={(e) => setDecision(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-[6px] text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                required
              >
                <option value="">Select decision...</option>
                <option value="approved">Approved</option>
                <option value="action_required">Action Required</option>
                <option value="reassessment_required">Reassessment Required</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">Rationale *</label>
              <textarea
                value={rationale}
                onChange={(e) => setRationale(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-border rounded-[6px] text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="Provide detailed rationale for your decision..."
                required
              />
            </div>
            {(decision === 'action_required' || decision === 'reassessment_required') && (
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">Actions for Assessor</label>
                <textarea
                  value={actionsForAssessor}
                  onChange={(e) => setActionsForAssessor(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-border rounded-[6px] text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Describe required actions for the assessor..."
                />
              </div>
            )}
            <button
              type="submit"
              disabled={submitting || !decision || !rationale}
              className="px-6 py-2 bg-primary text-white rounded-[6px] text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit Decision'}
            </button>
          </form>
        </Card>
      )}
    </div>
  );
}
