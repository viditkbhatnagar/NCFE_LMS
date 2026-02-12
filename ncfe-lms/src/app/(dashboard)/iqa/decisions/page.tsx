'use client';

import { useEffect, useState } from 'react';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';

interface Decision {
  _id: string;
  iqaSampleId: {
    assessorId: { name: string };
    learnerId: { name: string };
    unitId: { unitReference: string };
  };
  decision: string;
  rationale: string;
  actionsForAssessor: string;
  decidedAt: string;
}

export default function IQADecisionsPage() {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDecisions() {
      try {
        const res = await fetch('/api/iqa/decisions');
        const data = await res.json();
        if (data.success) setDecisions(data.data);
      } catch (error) {
        console.error('Failed to fetch decisions:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchDecisions();
  }, []);

  const decisionConfig: Record<string, { variant: 'success' | 'warning' | 'error'; label: string }> = {
    approved: { variant: 'success', label: 'Approved' },
    action_required: { variant: 'warning', label: 'Action Required' },
    reassessment_required: { variant: 'error', label: 'Reassessment Required' },
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-text-primary mb-6">IQA Decisions</h1>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-gray-200 rounded-[8px] animate-pulse" />)}
        </div>
      ) : decisions.length === 0 ? (
        <Card>
          <div className="text-center py-8 text-text-secondary">No IQA decisions recorded yet.</div>
        </Card>
      ) : (
        <div className="space-y-3">
          {decisions.map((dec) => (
            <Card key={dec._id}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant={decisionConfig[dec.decision]?.variant || 'default'}>
                      {decisionConfig[dec.decision]?.label || dec.decision}
                    </Badge>
                    <span className="text-xs text-text-muted">
                      {new Date(dec.decidedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm text-text-primary mb-1">
                    <strong>Rationale:</strong> {dec.rationale}
                  </p>
                  {dec.actionsForAssessor && (
                    <p className="text-sm text-text-secondary">
                      <strong>Actions:</strong> {dec.actionsForAssessor}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
