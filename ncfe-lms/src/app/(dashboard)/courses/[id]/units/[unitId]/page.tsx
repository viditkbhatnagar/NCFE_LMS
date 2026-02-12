'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';

interface AC {
  _id: string;
  acNumber: string;
  description: string;
  evidenceRequirements: string;
}

interface LO {
  _id: string;
  loNumber: string;
  description: string;
  assessmentCriteria: AC[];
}

interface UnitDetail {
  _id: string;
  unitReference: string;
  title: string;
  description: string;
}

export default function UnitDetailPage() {
  const params = useParams();
  const [unit, setUnit] = useState<UnitDetail | null>(null);
  const [learningOutcomes, setLearningOutcomes] = useState<LO[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedLOs, setExpandedLOs] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function fetchUnit() {
      try {
        const res = await fetch(`/api/units/${params.unitId}`);
        const data = await res.json();
        if (data.success) {
          setUnit(data.data.unit);
          setLearningOutcomes(data.data.learningOutcomes);
          // Expand all LOs by default
          setExpandedLOs(new Set(data.data.learningOutcomes.map((lo: LO) => lo._id)));
        }
      } catch (error) {
        console.error('Failed to fetch unit:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchUnit();
  }, [params.unitId]);

  const toggleLO = (loId: string) => {
    setExpandedLOs((prev) => {
      const next = new Set(prev);
      if (next.has(loId)) {
        next.delete(loId);
      } else {
        next.add(loId);
      }
      return next;
    });
  };

  const acStatusBadge = () => {
    return <Badge variant="default">Not Started</Badge>;
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-6 bg-gray-200 rounded w-2/3" />
        <div className="h-4 bg-gray-200 rounded w-1/3" />
        <div className="h-40 bg-gray-200 rounded" />
      </div>
    );
  }

  if (!unit) {
    return (
      <Card>
        <p className="text-text-secondary text-center py-8">Unit not found</p>
      </Card>
    );
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-text-muted mb-2 flex-wrap">
        <Link href="/courses" className="hover:text-primary">My Courses</Link>
        <span>/</span>
        <Link href={`/courses/${params.id}`} className="hover:text-primary">Course</Link>
        <span>/</span>
        <Link href={`/courses/${params.id}/units`} className="hover:text-primary">Units</Link>
        <span>/</span>
        <span className="text-text-secondary">{unit.unitReference}</span>
      </div>

      {/* Unit Header */}
      <div className="mb-6">
        <span className="text-xs font-medium text-primary bg-primary-light px-2 py-0.5 rounded">
          {unit.unitReference}
        </span>
        <h1 className="text-2xl font-bold text-text-primary mt-2">{unit.title}</h1>
        {unit.description && (
          <p className="text-text-secondary mt-2">{unit.description}</p>
        )}
      </div>

      {/* Learning Outcomes */}
      <div className="space-y-4">
        {learningOutcomes.map((lo) => (
          <Card key={lo._id} padding="none">
            {/* LO Header */}
            <button
              onClick={() => toggleLO(lo._id)}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-primary bg-primary-light px-2 py-1 rounded">
                  {lo.loNumber}
                </span>
                <span className="text-sm font-medium text-text-primary">{lo.description}</span>
              </div>
              <svg
                className={`w-5 h-5 text-text-muted transition-transform ${
                  expandedLOs.has(lo._id) ? 'rotate-180' : ''
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Assessment Criteria */}
            {expandedLOs.has(lo._id) && (
              <div className="border-t border-border">
                {lo.assessmentCriteria.map((ac) => (
                  <div
                    key={ac._id}
                    className="flex items-start gap-3 px-4 py-3 border-b border-border last:border-b-0 hover:bg-gray-50"
                  >
                    <span className="text-xs font-medium text-secondary bg-gray-100 px-2 py-0.5 rounded whitespace-nowrap mt-0.5">
                      {ac.acNumber}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text-primary">{ac.description}</p>
                      {ac.evidenceRequirements && (
                        <p className="text-xs text-text-muted mt-1">
                          Evidence: {ac.evidenceRequirements}
                        </p>
                      )}
                    </div>
                    <div className="flex-shrink-0">
                      {acStatusBadge()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="mt-6 flex gap-3">
        <Link
          href={`/portfolio/${params.unitId}/upload`}
          className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-[6px] text-sm font-medium hover:bg-primary-dark transition-colors"
        >
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Upload Evidence
        </Link>
        <Link
          href={`/courses/${params.id}/materials`}
          className="inline-flex items-center px-4 py-2 border border-border bg-white text-text-primary rounded-[6px] text-sm font-medium hover:bg-background transition-colors"
        >
          View Materials
        </Link>
      </div>
    </div>
  );
}
