'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import ProgressBar from '@/components/ui/ProgressBar';

interface LearnerProgress {
  learner: { _id: string; name: string; email: string };
  enrolments: {
    enrolmentId: string;
    qualification: { title: string; code: string };
    overallProgress: number;
    completedUnits: number;
    totalUnits: number;
  }[];
}

export default function AssessorProgressPage() {
  const [learners, setLearners] = useState<LearnerProgress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProgress() {
      try {
        const res = await fetch('/api/assessor/learners');
        const data = await res.json();
        if (data.success) {
          // Fetch detailed progress for each learner
          const detailed = await Promise.all(
            data.data.map(async (item: { learner: { _id: string; name: string; email: string } }) => {
              try {
                const progressRes = await fetch(`/api/progress/learner/${item.learner._id}`);
                const progressData = await progressRes.json();
                return {
                  learner: item.learner,
                  enrolments: progressData.success ? progressData.data.enrolments : [],
                };
              } catch {
                return { learner: item.learner, enrolments: [] };
              }
            })
          );
          setLearners(detailed);
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
        <h1 className="text-2xl font-bold text-text-primary mb-6">Learner Progress</h1>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-gray-200 rounded-[8px] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-text-primary mb-6">Learner Progress</h1>

      {learners.length === 0 ? (
        <Card>
          <div className="text-center py-8 text-text-secondary">No assigned learners found.</div>
        </Card>
      ) : (
        <div className="space-y-4">
          {learners.map((item) => (
            <Link key={item.learner._id} href={`/assessor/learners/${item.learner._id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex items-center gap-4 mb-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                    {item.learner.name?.charAt(0)?.toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">{item.learner.name}</h3>
                    <p className="text-xs text-text-muted">{item.learner.email}</p>
                  </div>
                </div>
                {item.enrolments.map((enr, idx) => (
                  <div key={idx} className="mb-2 last:mb-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-text-secondary">{enr.qualification?.title}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-text-primary">{enr.overallProgress}%</span>
                        {enr.completedUnits === enr.totalUnits && enr.totalUnits > 0 ? (
                          <Badge variant="success">Complete</Badge>
                        ) : (
                          <span className="text-xs text-text-muted">
                            {enr.completedUnits}/{enr.totalUnits} units
                          </span>
                        )}
                      </div>
                    </div>
                    <ProgressBar value={enr.overallProgress} size="sm" />
                  </div>
                ))}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
