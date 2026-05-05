'use client';

import { useEffect, useState } from 'react';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import ConfirmDialog from '@/components/admin/ConfirmDialog';

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
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function fetchDecisions() {
    setLoading(true);
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

  useEffect(() => {
    fetchDecisions();
  }, []);

  const decisionConfig: Record<string, { variant: 'success' | 'warning' | 'error'; label: string }> = {
    approved: { variant: 'success', label: 'Approved' },
    action_required: { variant: 'warning', label: 'Action Required' },
    reassessment_required: { variant: 'error', label: 'Reassessment Required' },
  };

  const handleDeleteConfirm = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/iqa/decisions/${deleteId}`, { method: 'DELETE' });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        console.error('Delete failed:', json.error || res.statusText);
      }
      setDeleteId(null);
      await fetchDecisions();
    } catch (err) {
      console.error('Error deleting IQA decision:', err);
    } finally {
      setDeleting(false);
    }
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
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
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
                <button
                  type="button"
                  onClick={() => setDeleteId(dec._id)}
                  className="p-2 rounded hover:bg-red-50 text-text-muted hover:text-red-600"
                  title="Delete decision"
                  aria-label="Delete decision"
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
        title="Delete IQA decision?"
        message="This permanently removes the decision. The linked sample will revert to pending if no other decisions remain."
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
