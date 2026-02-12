'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';

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

  useEffect(() => {
    async function fetchSamples() {
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
    fetchSamples();
  }, []);

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
            <Link key={sample._id} href={`/iqa/sampling/${sample._id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer mb-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
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
