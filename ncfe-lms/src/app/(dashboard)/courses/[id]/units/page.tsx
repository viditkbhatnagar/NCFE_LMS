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

export default function UnitsListPage() {
  const params = useParams();
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUnits() {
      try {
        const res = await fetch(`/api/qualifications/${params.id}`);
        const data = await res.json();
        if (data.success) {
          setUnits(data.data.units);
        }
      } catch (error) {
        console.error('Failed to fetch units:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchUnits();
  }, [params.id]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-gray-200 rounded-[8px]" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-text-muted mb-2">
        <Link href="/courses" className="hover:text-primary">My Courses</Link>
        <span>/</span>
        <Link href={`/courses/${params.id}`} className="hover:text-primary">Course</Link>
        <span>/</span>
        <span className="text-text-secondary">Units</span>
      </div>
      <h1 className="text-2xl font-bold text-text-primary mb-6">Units</h1>

      <div className="space-y-4">
        {units.map((unit, index) => (
          <Link key={unit._id} href={`/courses/${params.id}/units/${unit._id}`}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer mb-4">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-primary">{unit.unitReference}</span>
                    <Badge variant="default">Not Started</Badge>
                  </div>
                  <h3 className="text-base font-semibold text-text-primary mb-1">{unit.title}</h3>
                  {unit.description && (
                    <p className="text-sm text-text-secondary line-clamp-2">{unit.description}</p>
                  )}
                  <div className="mt-3">
                    <ProgressBar value={0} size="sm" />
                  </div>
                </div>
                <svg className="w-5 h-5 text-text-muted mt-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
