'use client';

import { useEffect, useState } from 'react';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Link from 'next/link';

interface IQAStats {
  pendingSamples: number;
  assessorsCount: number;
  openActions: number;
  completedSamples: number;
}

export default function IQADashboardPage() {
  const [stats, setStats] = useState<IQAStats>({ pendingSamples: 0, assessorsCount: 0, openActions: 0, completedSamples: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch('/api/dashboard/iqa');
        const data = await res.json();
        if (data.success) setStats(data.data);
      } catch (error) {
        console.error('Failed to fetch IQA stats:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 bg-gray-200 rounded-[8px] animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Quality Assurance Dashboard</h1>
        <p className="text-text-secondary mt-1">Monitor assessment quality and sampling coverage</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard title="Awaiting Sampling" value={stats.pendingSamples} color="bg-warning" />
        <StatCard title="Assessors Monitored" value={stats.assessorsCount} color="bg-info" />
        <StatCard title="Open Actions" value={stats.openActions} color="bg-error" />
        <StatCard title="Completed Samples" value={stats.completedSamples} color="bg-success" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <h2 className="text-lg font-semibold text-text-primary mb-4">Quick Actions</h2>
          <div className="space-y-2">
            <Link href="/iqa/sampling" className="flex items-center gap-3 p-3 rounded-[6px] hover:bg-gray-50 transition-colors">
              <div className="w-8 h-8 rounded bg-primary-light flex items-center justify-center">
                <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <span className="text-sm font-medium text-text-primary">Create Sampling Plan</span>
            </Link>
            <Link href="/iqa/decisions" className="flex items-center gap-3 p-3 rounded-[6px] hover:bg-gray-50 transition-colors">
              <div className="w-8 h-8 rounded bg-brand-100 flex items-center justify-center">
                <svg className="w-4 h-4 text-info" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
                </svg>
              </div>
              <span className="text-sm font-medium text-text-primary">Review Decisions</span>
            </Link>
            <Link href="/iqa/eqa-readiness" className="flex items-center gap-3 p-3 rounded-[6px] hover:bg-gray-50 transition-colors">
              <div className="w-8 h-8 rounded bg-green-100 flex items-center justify-center">
                <svg className="w-4 h-4 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="text-sm font-medium text-text-primary">EQA Readiness Check</span>
            </Link>
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-text-primary mb-4">Sampling Coverage</h2>
          <div className="space-y-3">
            <CoverageItem label="Assessor Coverage" value={0} />
            <CoverageItem label="Learner Coverage" value={0} />
            <CoverageItem label="Unit Coverage" value={0} />
            <CoverageItem label="Method Coverage" value={0} />
          </div>
          <p className="text-xs text-text-muted mt-4">
            NCFE requires sampling across different assessors, learners, methods, and stages.
          </p>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ title, value, color }: { title: string; value: number; color: string }) {
  return (
    <div className="bg-card rounded-[8px] shadow-sm border border-border p-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-text-secondary">{title}</h3>
        <div className={`w-2 h-2 rounded-full ${color}`} />
      </div>
      <p className="text-3xl font-bold text-text-primary">{value}</p>
    </div>
  );
}

function CoverageItem({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm text-text-secondary">{label}</span>
        <span className="text-sm font-medium text-text-primary">{value}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div className="bg-primary h-2 rounded-full" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
