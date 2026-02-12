'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

export default function FeedbackPage() {
  const params = useParams();
  const router = useRouter();
  const [strengths, setStrengths] = useState('');
  const [gaps, setGaps] = useState('');
  const [actionsRequired, setActionsRequired] = useState('');
  const [isResubmissionRequired, setIsResubmissionRequired] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [existingFeedback, setExistingFeedback] = useState(false);

  useEffect(() => {
    async function fetchExisting() {
      try {
        const res = await fetch(`/api/feedback/${params.id}`);
        const data = await res.json();
        if (data.success && data.data) {
          setStrengths(data.data.strengths || '');
          setGaps(data.data.gaps || '');
          setActionsRequired(data.data.actionsRequired || '');
          setIsResubmissionRequired(data.data.isResubmissionRequired || false);
          setExistingFeedback(true);
        }
      } catch {
        // No existing feedback, that's fine
      }
    }
    fetchExisting();
  }, [params.id]);

  const handleSubmit = async () => {
    if (!strengths.trim()) {
      setError('Strengths feedback is required');
      return;
    }

    setError('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId: params.id,
          strengths,
          gaps,
          actionsRequired,
          isResubmissionRequired,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to save feedback');
        return;
      }
      router.push(`/assessor/submissions/${params.id}`);
    } catch {
      setError('Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-text-muted mb-2">
        <Link href="/assessor/submissions" className="hover:text-primary">Submissions</Link>
        <span>/</span>
        <Link href={`/assessor/submissions/${params.id}`} className="hover:text-primary">Detail</Link>
        <span>/</span>
        <span className="text-text-secondary">Feedback</span>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">
          {existingFeedback ? 'Update' : 'Provide'} Feedback
        </h1>
        <p className="text-text-secondary mt-1">
          Feedback must be clear, constructive, action-focused, and criterion-referenced.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-[6px] text-sm text-error">{error}</div>
      )}

      <div className="space-y-6">
        <Card>
          <h2 className="text-base font-semibold text-text-primary mb-3">Strengths</h2>
          <p className="text-xs text-text-muted mb-2">
            Highlight what the learner has done well, referencing specific AC numbers.
          </p>
          <textarea
            value={strengths}
            onChange={(e) => setStrengths(e.target.value)}
            placeholder="e.g., AC 1.1 is clearly met with a thorough explanation of assessment functions..."
            className="w-full px-3 py-2 border border-border rounded-[6px] text-sm bg-white placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary"
            rows={4}
          />
        </Card>

        <Card>
          <h2 className="text-base font-semibold text-text-primary mb-3">Gaps</h2>
          <p className="text-xs text-text-muted mb-2">
            Identify specific gaps against AC numbers.
          </p>
          <textarea
            value={gaps}
            onChange={(e) => setGaps(e.target.value)}
            placeholder="e.g., AC 2.1 is partially met. Please expand your explanation of formative assessment methods..."
            className="w-full px-3 py-2 border border-border rounded-[6px] text-sm bg-white placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary"
            rows={4}
          />
        </Card>

        <Card>
          <h2 className="text-base font-semibold text-text-primary mb-3">Actions Required</h2>
          <p className="text-xs text-text-muted mb-2">
            Clear instructions for what the learner needs to do (if resubmission).
          </p>
          <textarea
            value={actionsRequired}
            onChange={(e) => setActionsRequired(e.target.value)}
            placeholder="e.g., 1. Expand AC 2.1 response with workplace example. 2. Provide additional evidence for AC 3.2..."
            className="w-full px-3 py-2 border border-border rounded-[6px] text-sm bg-white placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary"
            rows={4}
          />
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-text-primary">Resubmission Required?</h2>
              <p className="text-xs text-text-muted mt-1">
                Toggle if the learner needs to revise and resubmit their evidence.
              </p>
            </div>
            <button
              onClick={() => setIsResubmissionRequired(!isResubmissionRequired)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                isResubmissionRequired ? 'bg-warning' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isResubmissionRequired ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </Card>
      </div>

      <div className="mt-6 flex gap-3">
        <Button onClick={handleSubmit} isLoading={submitting} size="lg">
          {existingFeedback ? 'Update' : 'Submit'} Feedback
        </Button>
        <Button variant="outline" onClick={() => router.back()} size="lg">
          Cancel
        </Button>
      </div>
    </div>
  );
}
