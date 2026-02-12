'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';

interface EvidenceMapping {
  _id: string;
  assessmentCriteriaId: {
    acNumber: string;
    description: string;
  };
}

interface EvidenceItem {
  _id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  label: string;
  description: string;
  status: string;
  uploadedAt: string;
  attemptNumber: number;
  mappings: EvidenceMapping[];
}

interface UnitGroup {
  unitId: string;
  unitReference: string;
  unitTitle: string;
  evidence: EvidenceItem[];
}

export default function PortfolioPage() {
  const [unitGroups, setUnitGroups] = useState<UnitGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolmentId, setEnrolmentId] = useState<string>('');

  useEffect(() => {
    async function fetchPortfolio() {
      try {
        // First get enrolments to find the active one
        const enrolRes = await fetch('/api/enrolments');
        const enrolData = await enrolRes.json();
        if (enrolData.success && enrolData.data.length > 0) {
          const activeEnrolment = enrolData.data[0];
          setEnrolmentId(activeEnrolment._id);

          const res = await fetch(`/api/portfolio/${activeEnrolment._id}`);
          const data = await res.json();
          if (data.success) {
            setUnitGroups(data.data);
          }
        }
      } catch (error) {
        console.error('Failed to fetch portfolio:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchPortfolio();
  }, []);

  const statusBadge = (status: string) => {
    const config: Record<string, { variant: 'default' | 'info' | 'warning' | 'success'; label: string }> = {
      draft: { variant: 'default', label: 'Draft' },
      submitted: { variant: 'info', label: 'Submitted' },
      assessed: { variant: 'success', label: 'Assessed' },
    };
    const { variant, label } = config[status] || config.draft;
    return <Badge variant={variant}>{label}</Badge>;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-6 bg-gray-200 rounded w-1/3" />
        <div className="h-40 bg-gray-200 rounded" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Portfolio</h1>
          <p className="text-text-secondary mt-1">Manage your evidence files and AC mappings</p>
        </div>
      </div>

      {unitGroups.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <svg className="w-16 h-16 text-text-muted mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <h3 className="text-lg font-medium text-text-primary mb-2">No evidence uploaded yet</h3>
            <p className="text-text-secondary mb-6">Start building your portfolio by uploading evidence for your units.</p>
            <Link
              href="/courses"
              className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-[6px] text-sm font-medium hover:bg-primary-dark"
            >
              Browse Courses & Units
            </Link>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {unitGroups.map((group) => (
            <Card key={group.unitId} padding="none">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium text-primary">{group.unitReference}</span>
                  <h3 className="text-base font-semibold text-text-primary">{group.unitTitle}</h3>
                </div>
                <Link
                  href={`/portfolio/${group.unitId}/upload`}
                  className="inline-flex items-center px-3 py-1.5 bg-primary text-white rounded-[6px] text-xs font-medium hover:bg-primary-dark"
                >
                  <svg className="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Evidence
                </Link>
              </div>

              {group.evidence.length === 0 ? (
                <div className="p-6 text-center text-text-muted text-sm">
                  No evidence uploaded for this unit yet.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {group.evidence.map((item) => (
                    <div key={item._id} className="p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center text-text-muted flex-shrink-0">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="text-sm font-medium text-text-primary">{item.label}</h4>
                            <p className="text-xs text-text-muted mt-0.5">
                              {item.fileName} &middot; {formatFileSize(item.fileSize)} &middot; Attempt {item.attemptNumber}
                            </p>
                            {item.description && (
                              <p className="text-xs text-text-secondary mt-1">{item.description}</p>
                            )}
                            {item.mappings && item.mappings.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {item.mappings.map((m) => (
                                  <span
                                    key={m._id}
                                    className="text-xs bg-primary-light text-primary px-1.5 py-0.5 rounded"
                                  >
                                    {m.assessmentCriteriaId.acNumber}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          {statusBadge(item.status)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
