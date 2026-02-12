'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import ProgressBar from '@/components/ui/ProgressBar';

interface UnitProgress {
  unitId: string;
  unitReference: string;
  title: string;
  totalACs: number;
  metACs: number;
  evidenceCount: number;
  pendingSubmissions: number;
  progress: number;
  isComplete: boolean;
}

interface EnrolmentDetail {
  enrolmentId: string;
  qualification: { _id: string; title: string; code: string; level: number };
  status: string;
  enrolledAt: string;
  overallProgress: number;
  completedUnits: number;
  totalUnits: number;
  units: UnitProgress[];
}

interface LearnerData {
  learner: { _id: string; name: string; email: string; avatar?: string; status: string; phone?: string };
  enrolments: EnrolmentDetail[];
}

export default function AssessorLearnerDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState<LearnerData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLearner() {
      try {
        const res = await fetch(`/api/assessor/learners/${id}`);
        const json = await res.json();
        if (json.success) setData(json.data);
      } catch (error) {
        console.error('Failed to fetch learner:', error);
      } finally {
        setLoading(false);
      }
    }
    if (id) fetchLearner();
  }, [id]);

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-text-primary mb-6">Learner Profile</h1>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-gray-200 rounded-[8px] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-text-primary mb-6">Learner Profile</h1>
        <Card>
          <div className="text-center py-8 text-text-secondary">Learner not found or not assigned to you.</div>
        </Card>
      </div>
    );
  }

  const { learner, enrolments } = data;

  return (
    <div>
      <Link href="/assessor/learners" className="text-sm text-primary hover:underline mb-4 inline-block">
        &larr; Back to Learners
      </Link>

      <h1 className="text-2xl font-bold text-text-primary mb-6">Learner Profile</h1>

      {/* Learner Info Card */}
      <Card className="mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xl font-bold">
            {learner.name?.charAt(0)?.toUpperCase()}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-text-primary">{learner.name}</h2>
            <p className="text-sm text-text-secondary">{learner.email}</p>
            {learner.phone && <p className="text-sm text-text-muted">{learner.phone}</p>}
          </div>
          <div className="ml-auto">
            <Badge variant={learner.status === 'active' ? 'success' : 'default'}>
              {learner.status}
            </Badge>
          </div>
        </div>
      </Card>

      {/* Enrolments */}
      {enrolments.map((enrolment) => (
        <div key={enrolment.enrolmentId} className="mb-8">
          <Card className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-lg font-semibold text-text-primary">{enrolment.qualification.title}</h3>
                <p className="text-sm text-text-secondary">
                  {enrolment.qualification.code} &middot; Level {enrolment.qualification.level}
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-primary">{enrolment.overallProgress}%</div>
                <p className="text-xs text-text-muted">
                  {enrolment.completedUnits}/{enrolment.totalUnits} units
                </p>
              </div>
            </div>
            <ProgressBar value={enrolment.overallProgress} size="md" />
          </Card>

          <div className="space-y-3">
            {enrolment.units.map((unit) => (
              <Link
                key={unit.unitId}
                href={`/assessor/learners/${id}/units/${unit.unitId}`}
              >
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-medium text-text-muted">{unit.unitReference}</span>
                      <h4 className="text-sm font-medium text-text-primary">{unit.title}</h4>
                    </div>
                    <div className="flex items-center gap-2">
                      {unit.pendingSubmissions > 0 && (
                        <Badge variant="warning">{unit.pendingSubmissions} pending</Badge>
                      )}
                      {unit.isComplete ? (
                        <Badge variant="success">Complete</Badge>
                      ) : (
                        <span className="text-sm font-medium text-text-primary">{unit.progress}%</span>
                      )}
                    </div>
                  </div>
                  <ProgressBar value={unit.progress} size="sm" />
                  <div className="flex items-center gap-4 mt-2 text-xs text-text-muted">
                    <span>{unit.metACs}/{unit.totalACs} ACs met</span>
                    <span>{unit.evidenceCount} evidence items</span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
