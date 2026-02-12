'use client';

import { useEffect, useState } from 'react';
import Card from '@/components/ui/Card';
import ProgressBar from '@/components/ui/ProgressBar';
import Badge from '@/components/ui/Badge';

interface ACProgress {
  acId: string;
  acNumber: string;
  description: string;
  isMet: boolean;
}

interface LOProgress {
  loId: string;
  loNumber: string;
  description: string;
  assessmentCriteria: ACProgress[];
}

interface UnitProgress {
  unitId: string;
  unitReference: string;
  title: string;
  totalACs: number;
  metACs: number;
  progress: number;
  isComplete: boolean;
  learningOutcomes: LOProgress[];
}

interface ProgressData {
  qualification: { title: string; code: string; level: number };
  enrolmentId: string;
  overallProgress: number;
  completedUnits: number;
  totalUnits: number;
  units: UnitProgress[];
}

export default function StudentProgressPage() {
  const [progressData, setProgressData] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedUnit, setExpandedUnit] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProgress() {
      try {
        const enrolRes = await fetch('/api/enrolments');
        const enrolData = await enrolRes.json();
        if (enrolData.success && enrolData.data.length > 0) {
          const enrolment = enrolData.data[0];
          const qualId = enrolment.qualificationId?._id || enrolment.qualificationId;
          const progressRes = await fetch(`/api/courses/${qualId}/progress`);
          const progressJson = await progressRes.json();
          if (progressJson.success) {
            setProgressData({
              ...progressJson.data,
              enrolmentId: enrolment._id,
            });
          }
        }
      } catch (error) {
        console.error('Failed to fetch progress:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchProgress();
  }, []);

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-text-primary mb-6">My Progress</h1>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-gray-200 rounded-[8px] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!progressData) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-text-primary mb-6">My Progress</h1>
        <Card>
          <div className="text-center py-8 text-text-secondary">
            No enrolment found. Please contact your centre administrator.
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-text-primary mb-6">My Progress</h1>

      {/* Overall Progress */}
      <Card className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">{progressData.qualification.title}</h2>
            <p className="text-sm text-text-secondary">
              {progressData.qualification.code} &middot; Level {progressData.qualification.level}
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-primary">{progressData.overallProgress}%</div>
            <p className="text-xs text-text-muted">
              {progressData.completedUnits}/{progressData.totalUnits} units complete
            </p>
          </div>
        </div>
        <ProgressBar value={progressData.overallProgress} size="lg" />
      </Card>

      {/* Per-Unit Progress */}
      <div className="space-y-4">
        {progressData.units?.map((unit) => (
          <Card key={unit.unitId}>
            <div
              className="cursor-pointer"
              onClick={() => setExpandedUnit(expandedUnit === unit.unitId ? null : unit.unitId)}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-text-muted">{unit.unitReference}</span>
                  <h3 className="text-sm font-semibold text-text-primary">{unit.title}</h3>
                </div>
                <div className="flex items-center gap-3">
                  {unit.isComplete ? (
                    <Badge variant="success">Complete</Badge>
                  ) : unit.metACs > 0 ? (
                    <Badge variant="info">In Progress</Badge>
                  ) : (
                    <Badge variant="default">Not Started</Badge>
                  )}
                  <span className="text-sm font-medium text-text-primary">{unit.progress}%</span>
                  <svg
                    className={`w-4 h-4 text-text-muted transition-transform ${expandedUnit === unit.unitId ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
              <ProgressBar value={unit.progress} size="sm" />
              <p className="text-xs text-text-muted mt-2">
                {unit.metACs} of {unit.totalACs} assessment criteria met
              </p>
            </div>

            {expandedUnit === unit.unitId && unit.learningOutcomes && (
              <div className="mt-4 pt-4 border-t border-border space-y-4">
                {unit.learningOutcomes.map((lo) => (
                  <div key={lo.loId}>
                    <h4 className="text-sm font-medium text-text-primary mb-2">
                      {lo.loNumber}: {lo.description}
                    </h4>
                    <div className="space-y-1.5 ml-4">
                      {lo.assessmentCriteria.map((ac) => (
                        <div key={ac.acId} className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
                            ac.isMet ? 'bg-primary' : 'bg-gray-200'
                          }`}>
                            {ac.isMet && (
                              <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <span className={`text-xs ${ac.isMet ? 'text-text-primary' : 'text-text-muted'}`}>
                            {ac.acNumber}: {ac.description}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
