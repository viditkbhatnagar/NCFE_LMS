'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';

interface FeedbackData {
  strengths: string;
  gaps: string;
  actionsRequired: string;
  isResubmissionRequired: boolean;
  createdAt: string;
  assessorId: { name: string };
}

interface DecisionData {
  assessmentCriteriaId: { acNumber: string; description: string };
  decision: string;
  vascValid: boolean;
  vascAuthentic: boolean;
  vascSufficient: boolean;
  vascCurrent: boolean;
}

export default function StudentFeedbackPage() {
  const params = useParams();
  const [feedback, setFeedback] = useState<FeedbackData | null>(null);
  const [decisions, setDecisions] = useState<DecisionData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [fbRes, decRes] = await Promise.all([
          fetch(`/api/feedback/${params.id}`),
          fetch(`/api/assessments/decisions/${params.id}`),
        ]);
        const [fbData, decData] = await Promise.all([fbRes.json(), decRes.json()]);
        if (fbData.success) setFeedback(fbData.data);
        if (decData.success) setDecisions(decData.data);
      } catch (error) {
        console.error('Failed to fetch feedback:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [params.id]);

  if (loading) return <div className="animate-pulse h-40 bg-gray-200 rounded-[8px]" />;

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-text-muted mb-2">
        <Link href="/submissions" className="hover:text-primary">Submissions</Link>
        <span>/</span>
        <span className="text-text-secondary">Feedback</span>
      </div>

      <h1 className="text-2xl font-bold text-text-primary mb-6">Assessment Feedback</h1>

      {feedback?.isResubmissionRequired && (
        <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-[8px] flex items-center gap-3">
          <svg className="w-5 h-5 text-warning flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-orange-800">Resubmission Required</p>
            <p className="text-xs text-orange-700">Please review the feedback below and resubmit your evidence.</p>
          </div>
        </div>
      )}

      {/* Assessment Decisions */}
      {decisions.length > 0 && (
        <Card className="mb-6">
          <h2 className="text-lg font-semibold text-text-primary mb-4">Assessment Decisions</h2>
          <div className="space-y-2">
            {decisions.map((d, i) => (
              <div key={i} className="flex items-center justify-between p-3 border border-border rounded-[6px]">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-secondary bg-gray-100 px-2 py-0.5 rounded">
                    {d.assessmentCriteriaId?.acNumber}
                  </span>
                  <span className="text-sm text-text-primary">{d.assessmentCriteriaId?.description}</span>
                </div>
                <Badge variant={d.decision === 'met' ? 'success' : 'warning'}>
                  {d.decision === 'met' ? 'Met' : 'Not Yet Met'}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Feedback */}
      {feedback ? (
        <div className="space-y-4">
          {feedback.strengths && (
            <Card>
              <h3 className="text-base font-semibold text-green-700 mb-2">Strengths</h3>
              <p className="text-sm text-text-primary whitespace-pre-wrap">{feedback.strengths}</p>
            </Card>
          )}
          {feedback.gaps && (
            <Card>
              <h3 className="text-base font-semibold text-orange-700 mb-2">Gaps</h3>
              <p className="text-sm text-text-primary whitespace-pre-wrap">{feedback.gaps}</p>
            </Card>
          )}
          {feedback.actionsRequired && (
            <Card>
              <h3 className="text-base font-semibold text-error mb-2">Actions Required</h3>
              <p className="text-sm text-text-primary whitespace-pre-wrap">{feedback.actionsRequired}</p>
            </Card>
          )}
          <p className="text-xs text-text-muted">
            Feedback from {feedback.assessorId?.name} on {new Date(feedback.createdAt).toLocaleDateString()}
          </p>
        </div>
      ) : (
        <Card>
          <p className="text-center py-8 text-text-secondary">No feedback available yet.</p>
        </Card>
      )}
    </div>
  );
}
