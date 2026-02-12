'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import ProgressBar from '@/components/ui/ProgressBar';

interface Unit {
  _id: string;
  unitReference: string;
  title: string;
  description: string;
}

interface Qualification {
  _id: string;
  title: string;
  level: number;
  code: string;
  awardingBody: string;
  description: string;
}

export default function CourseOverviewPage() {
  const params = useParams();
  const [qualification, setQualification] = useState<Qualification | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCourse() {
      try {
        const res = await fetch(`/api/qualifications/${params.id}`);
        const data = await res.json();
        if (data.success) {
          setQualification(data.data.qualification);
          setUnits(data.data.units);
        }
      } catch (error) {
        console.error('Failed to fetch course:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchCourse();
  }, [params.id]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-6 bg-gray-200 rounded w-2/3" />
        <div className="h-4 bg-gray-200 rounded w-1/3" />
        <div className="h-32 bg-gray-200 rounded" />
      </div>
    );
  }

  if (!qualification) {
    return (
      <Card>
        <p className="text-text-secondary text-center py-8">Course not found</p>
      </Card>
    );
  }

  return (
    <div>
      {/* Course Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-text-muted mb-2">
          <Link href="/courses" className="hover:text-primary">My Courses</Link>
          <span>/</span>
          <span className="text-text-secondary">Course Overview</span>
        </div>
        <h1 className="text-2xl font-bold text-text-primary">{qualification.title}</h1>
        <div className="flex items-center gap-3 mt-2">
          <Badge variant="info">Level {qualification.level}</Badge>
          <span className="text-sm text-text-muted">{qualification.code}</span>
          <span className="text-sm text-text-muted">{qualification.awardingBody}</span>
        </div>
      </div>

      {/* Overview Card */}
      <Card className="mb-6">
        <h2 className="text-lg font-semibold text-text-primary mb-2">Qualification Overview</h2>
        <p className="text-sm text-text-secondary leading-relaxed">{qualification.description}</p>
        <div className="mt-4">
          <ProgressBar value={0} />
        </div>
      </Card>

      {/* Navigation Tabs */}
      <div className="flex gap-1 bg-card rounded-[8px] border border-border p-1 mb-6 overflow-x-auto">
        {[
          { label: 'Overview', href: `/courses/${qualification._id}`, active: true },
          { label: 'Units', href: `/courses/${qualification._id}/units` },
          { label: 'Materials', href: `/courses/${qualification._id}/materials` },
          { label: 'Assessments', href: `/courses/${qualification._id}/assessments` },
        ].map((tab) => (
          <Link
            key={tab.label}
            href={tab.href}
            className={`px-4 py-2 text-sm font-medium rounded-[6px] transition-colors whitespace-nowrap ${
              tab.active
                ? 'bg-primary text-white'
                : 'text-text-secondary hover:bg-background'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {/* Mandatory Units */}
      <div>
        <h2 className="text-lg font-semibold text-text-primary mb-4">
          Mandatory Units ({units.length})
        </h2>
        <div className="space-y-3">
          {units.map((unit) => (
            <Link key={unit._id} href={`/courses/${qualification._id}/units/${unit._id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer mb-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-primary bg-primary-light px-2 py-0.5 rounded">
                        {unit.unitReference}
                      </span>
                      <Badge variant="default">Not Started</Badge>
                    </div>
                    <h3 className="text-sm font-semibold text-text-primary">{unit.title}</h3>
                    {unit.description && (
                      <p className="text-xs text-text-muted mt-1 line-clamp-2">{unit.description}</p>
                    )}
                  </div>
                  <svg className="w-5 h-5 text-text-muted ml-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
