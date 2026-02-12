'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

interface AC {
  _id: string;
  acNumber: string;
  description: string;
}

interface Decision {
  assessmentCriteriaId: string;
  decision: 'met' | 'not_yet_met' | '';
  vascValid: boolean;
  vascAuthentic: boolean;
  vascSufficient: boolean;
  vascCurrent: boolean;
  notes: string;
}

export default function AssessSubmissionPage() {
  const params = useParams();
  const router = useRouter();
  const [assessmentCriteria, setAssessmentCriteria] = useState<AC[]>([]);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        // Get submission to find the unit
        const subRes = await fetch(`/api/submissions/${params.id}`);
        const subData = await subRes.json();
        if (!subData.success) return;

        // Get unit ACs
        const unitRes = await fetch(`/api/units/${subData.data.unitId._id || subData.data.unitId}`);
        const unitData = await unitRes.json();
        if (unitData.success) {
          const acs: AC[] = [];
          for (const lo of unitData.data.learningOutcomes) {
            for (const ac of lo.assessmentCriteria) {
              acs.push({ _id: ac._id, acNumber: ac.acNumber, description: ac.description });
            }
          }
          setAssessmentCriteria(acs);

          // Initialize decisions
          const initial: Record<string, Decision> = {};
          acs.forEach((ac) => {
            initial[ac._id] = {
              assessmentCriteriaId: ac._id,
              decision: '',
              vascValid: false,
              vascAuthentic: false,
              vascSufficient: false,
              vascCurrent: false,
              notes: '',
            };
          });

          // Load existing decisions
          const decRes = await fetch(`/api/assessments/decisions/${params.id}`);
          const decData = await decRes.json();
          if (decData.success && decData.data.length > 0) {
            decData.data.forEach((d: { assessmentCriteriaId: string | { _id: string }; decision: string; vascValid: boolean; vascAuthentic: boolean; vascSufficient: boolean; vascCurrent: boolean; notes: string }) => {
              const acId = typeof d.assessmentCriteriaId === 'string' ? d.assessmentCriteriaId : d.assessmentCriteriaId._id;
              if (initial[acId]) {
                initial[acId] = {
                  assessmentCriteriaId: acId,
                  decision: d.decision as 'met' | 'not_yet_met',
                  vascValid: d.vascValid,
                  vascAuthentic: d.vascAuthentic,
                  vascSufficient: d.vascSufficient,
                  vascCurrent: d.vascCurrent,
                  notes: d.notes || '',
                };
              }
            });
          }

          setDecisions(initial);
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [params.id]);

  const updateDecision = (acId: string, field: keyof Decision, value: string | boolean) => {
    setDecisions((prev) => ({
      ...prev,
      [acId]: { ...prev[acId], [field]: value },
    }));
  };

  const allVascChecked = (d: Decision) =>
    d.vascValid && d.vascAuthentic && d.vascSufficient && d.vascCurrent;

  const handleSubmit = async () => {
    setError('');
    const decisionList = Object.values(decisions).filter((d) => d.decision);

    if (decisionList.length === 0) {
      setError('Please make at least one assessment decision');
      return;
    }

    // Validate VASC for met decisions
    for (const d of decisionList) {
      if (d.decision === 'met' && !allVascChecked(d)) {
        setError(`All VASC checks must be completed for "Met" decisions. Check AC with missing VASC.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/assessments/decisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId: params.id,
          decisions: decisionList,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to save decisions');
        return;
      }
      router.push(`/assessor/submissions/${params.id}/feedback`);
    } catch {
      setError('Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="animate-pulse h-60 bg-gray-200 rounded-[8px]" />;

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-text-muted mb-2">
        <Link href="/assessor/submissions" className="hover:text-primary">Submissions</Link>
        <span>/</span>
        <Link href={`/assessor/submissions/${params.id}`} className="hover:text-primary">Detail</Link>
        <span>/</span>
        <span className="text-text-secondary">Assess</span>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Assessment Decisions</h1>
        <p className="text-text-secondary mt-1">
          Assess each criterion. For &quot;Met&quot; decisions, all VASC checks are required.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-[6px] text-sm text-error">{error}</div>
      )}

      <div className="space-y-4">
        {assessmentCriteria.map((ac) => {
          const d = decisions[ac._id];
          if (!d) return null;

          return (
            <Card key={ac._id}>
              <div className="flex items-start gap-3 mb-4">
                <span className="text-xs font-bold text-primary bg-primary-light px-2 py-1 rounded whitespace-nowrap">
                  {ac.acNumber}
                </span>
                <p className="text-sm text-text-primary flex-1">{ac.description}</p>
              </div>

              {/* Decision Toggle */}
              <div className="flex items-center gap-2 mb-4">
                <span className="text-sm text-text-secondary mr-2">Decision:</span>
                <button
                  onClick={() => updateDecision(ac._id, 'decision', 'met')}
                  disabled={!allVascChecked(d)}
                  className={`px-4 py-1.5 rounded-[6px] text-sm font-medium transition-colors ${
                    d.decision === 'met'
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-100 text-text-secondary hover:bg-gray-200'
                  } ${!allVascChecked(d) ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  Met
                </button>
                <button
                  onClick={() => updateDecision(ac._id, 'decision', 'not_yet_met')}
                  className={`px-4 py-1.5 rounded-[6px] text-sm font-medium transition-colors ${
                    d.decision === 'not_yet_met'
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 text-text-secondary hover:bg-gray-200'
                  }`}
                >
                  Not Yet Met
                </button>
              </div>

              {/* VASC Checklist */}
              <div className="bg-gray-50 rounded-[6px] p-3 mb-3">
                <p className="text-xs font-medium text-text-secondary mb-2">
                  VASC Compliance Check (all required for &quot;Met&quot;)
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {[
                    { key: 'vascValid' as const, label: 'Valid' },
                    { key: 'vascAuthentic' as const, label: 'Authentic' },
                    { key: 'vascSufficient' as const, label: 'Sufficient' },
                    { key: 'vascCurrent' as const, label: 'Current' },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={d[key]}
                        onChange={(e) => updateDecision(ac._id, key, e.target.checked)}
                        className="rounded border-border text-primary focus:ring-primary"
                      />
                      <span className="text-sm text-text-primary">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <textarea
                placeholder="Assessment notes (optional)"
                value={d.notes}
                onChange={(e) => updateDecision(ac._id, 'notes', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-[6px] text-sm bg-white placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary"
                rows={2}
              />
            </Card>
          );
        })}
      </div>

      <div className="mt-6 flex gap-3">
        <Button onClick={handleSubmit} isLoading={submitting} size="lg">
          Save Decisions & Continue to Feedback
        </Button>
        <Button variant="outline" onClick={() => router.back()} size="lg">
          Cancel
        </Button>
      </div>
    </div>
  );
}
