'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/admin/ConfirmDialog';

interface Sample {
  _id: string;
  assessorId: { _id: string; name: string };
  learnerId: { _id: string; name: string };
  unitId: { _id: string; unitReference: string; title: string };
  stage: string;
  status: string;
  assessmentMethodsSampled: string[];
  createdAt: string;
}

export default function SamplingPlansPage() {
  const [samples, setSamples] = useState<Sample[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function fetchSamples() {
    setLoading(true);
    try {
      const res = await fetch('/api/iqa/samples');
      const data = await res.json();
      if (data.success) setSamples(data.data);
    } catch (error) {
      console.error('Failed to fetch samples:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSamples();
  }, []);

  const handleDeleteConfirm = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/iqa/samples/${deleteId}`, { method: 'DELETE' });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        console.error('Delete failed:', json.error || res.statusText);
      }
      setDeleteId(null);
      await fetchSamples();
    } catch (err) {
      console.error('Error deleting IQA sample:', err);
    } finally {
      setDeleting(false);
    }
  };

  const statusConfig: Record<string, { variant: 'default' | 'warning' | 'success'; label: string }> = {
    pending: { variant: 'warning', label: 'Pending' },
    reviewed: { variant: 'default', label: 'Reviewed' },
    completed: { variant: 'success', label: 'Completed' },
  };

  const stageConfig: Record<string, { variant: 'info' | 'warning' | 'success'; label: string }> = {
    early: { variant: 'info', label: 'Early' },
    mid: { variant: 'warning', label: 'Mid' },
    late: { variant: 'success', label: 'Late' },
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Sampling Plans</h1>
          <p className="text-text-secondary mt-1">Create and manage IQA sampling plans</p>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)}>
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Sample
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-gray-200 rounded-[8px] animate-pulse" />)}
        </div>
      ) : samples.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <svg className="w-12 h-12 text-text-muted mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <h3 className="text-lg font-medium text-text-primary mb-2">No sampling plans yet</h3>
            <p className="text-text-secondary">Create your first sampling plan to begin quality assurance.</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {samples.map((sample) => (
            <Card key={sample._id} className="hover:shadow-md transition-shadow mb-3">
              <div className="flex items-center justify-between gap-3">
                <Link href={`/iqa/sampling/${sample._id}`} className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-text-primary">
                      {sample.assessorId?.name} &rarr; {sample.learnerId?.name}
                    </h3>
                    <Badge variant={statusConfig[sample.status]?.variant || 'default'}>
                      {statusConfig[sample.status]?.label || sample.status}
                    </Badge>
                    <Badge variant={stageConfig[sample.stage]?.variant || 'default'}>
                      Stage: {stageConfig[sample.stage]?.label || sample.stage}
                    </Badge>
                  </div>
                  <p className="text-xs text-text-secondary">
                    {sample.unitId?.unitReference} - {sample.unitId?.title}
                  </p>
                  <p className="text-xs text-text-muted mt-1">
                    Methods: {sample.assessmentMethodsSampled?.join(', ') || 'None specified'} &middot;{' '}
                    {new Date(sample.createdAt).toLocaleDateString()}
                  </p>
                </Link>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDeleteId(sample._id);
                  }}
                  className="p-2 rounded hover:bg-red-50 text-text-muted hover:text-red-600"
                  title="Delete sample"
                  aria-label="Delete sample"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteId}
        title="Delete sampling plan?"
        message="This will remove the sample and any linked decisions. This action cannot be undone."
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
