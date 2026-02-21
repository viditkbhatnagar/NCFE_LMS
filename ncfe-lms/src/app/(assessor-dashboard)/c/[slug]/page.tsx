'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAssessorCourse } from '@/contexts/AssessorCourseContext';
import HomeLearnerCard from '@/components/assessor/HomeLearnerCard';
import HomeRecentCard, { type RecentCardItem } from '@/components/assessor/HomeRecentCard';
import { TYPE_CONFIG, formatAssessmentDate } from '@/lib/assessment-utils';
import type {
  AssessorHomeDashboard,
  RecentAssessmentItem,
  RecentEvidenceItem,
  RecentMaterialItem,
  AssessmentKind,
} from '@/types';

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  published: 'bg-green-100 text-green-700',
  submitted: 'bg-brand-100 text-brand-700',
  assessed: 'bg-purple-100 text-purple-700',
};

function assessmentToCardItem(a: RecentAssessmentItem): RecentCardItem {
  const typeShort = a.assessmentKind ? TYPE_CONFIG[a.assessmentKind as AssessmentKind]?.short : '';
  return {
    _id: a._id,
    primaryText: a.title || 'Untitled',
    secondaryText: [a.learnerName, typeShort].filter(Boolean).join(' · '),
    metaText: a.date ? formatAssessmentDate(a.date) : '',
    badge: a.status,
    badgeClass: STATUS_BADGE[a.status] ?? 'bg-gray-100 text-gray-600',
  };
}

function evidenceToCardItem(ev: RecentEvidenceItem): RecentCardItem {
  return {
    _id: ev._id,
    primaryText: ev.fileName || ev.label,
    secondaryText: ev.learnerName,
    metaText: ev.uploadedAt ? formatAssessmentDate(ev.uploadedAt) : '',
    badge: ev.status,
    badgeClass: STATUS_BADGE[ev.status] ?? 'bg-gray-100 text-gray-600',
  };
}

function materialToCardItem(m: RecentMaterialItem): RecentCardItem {
  return {
    _id: m._id,
    primaryText: m.title,
    secondaryText: [m.category, m.fileType].filter(Boolean).join(' · '),
    metaText: m.createdAt ? formatAssessmentDate(m.createdAt) : '',
  };
}

// SVG icon components for card headers
const ClipboardIcon = (
  <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
  </svg>
);

const FolderIcon = (
  <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
  </svg>
);

const BookIcon = (
  <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>
);

export default function CourseHomePage() {
  const { qualification, userRole, currentEnrollmentId } = useAssessorCourse();
  const [data, setData] = useState<AssessorHomeDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    let url: string;
    if (userRole === 'student' && currentEnrollmentId) {
      url = `/api/v2/dashboard/student/${currentEnrollmentId}`;
    } else {
      const params = new URLSearchParams();
      if (currentEnrollmentId) params.set('enrollmentId', currentEnrollmentId);
      const qs = params.toString();
      url = `/api/v2/dashboard/assessor/${qualification._id}${qs ? `?${qs}` : ''}`;
    }
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch (err) {
      console.error('Error fetching home data:', err);
    } finally {
      setLoading(false);
    }
  }, [qualification._id, userRole, currentEnrollmentId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const slug = qualification.slug;
  const basePath = `/c/${slug}`;

  if (loading) {
    return (
      <div className="p-6 space-y-6 animate-pulse">
        <div>
          <div className="h-7 bg-gray-200 rounded w-96 mb-2" />
          <div className="h-4 bg-gray-100 rounded w-64" />
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-3">
          <div className="h-5 bg-gray-200 rounded w-32" />
          <div className="flex gap-4">
            <div className="h-10 bg-gray-100 rounded flex-1" />
            <div className="h-10 bg-gray-100 rounded flex-1" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-3">
            <div className="h-5 bg-gray-200 rounded w-40" />
            <div className="h-8 bg-gray-100 rounded" />
            <div className="h-8 bg-gray-100 rounded" />
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-3">
            <div className="h-5 bg-gray-200 rounded w-36" />
            <div className="h-8 bg-gray-100 rounded" />
            <div className="h-8 bg-gray-100 rounded" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{qualification.title}</h1>
        <p className="text-sm text-gray-400 mt-0.5">Course overview and recent activity</p>
      </div>

      {/* Row 1: My Learners — full width */}
      <HomeLearnerCard
        assessors={data?.assessors ?? []}
        learners={data?.learners ?? []}
        slug={slug}
        userRole={userRole}
      />

      {/* Row 2: Recent Assessments + Recent Evidence — two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <HomeRecentCard
          title="Recent Assessments"
          icon={ClipboardIcon}
          items={(data?.recentAssessments ?? []).map(assessmentToCardItem)}
          linkHref={`${basePath}/assessment`}
          linkLabel="View all"
          emptyText="No assessments yet"
        />
        <HomeRecentCard
          title="Recent Evidence"
          icon={FolderIcon}
          items={(data?.recentEvidence ?? []).map(evidenceToCardItem)}
          linkHref={`${basePath}/portfolio`}
          linkLabel="View all"
          emptyText="No evidence uploaded yet"
        />
      </div>

      {/* Row 3: Recent Materials — full width */}
      <HomeRecentCard
        title="Recent Materials"
        icon={BookIcon}
        items={(data?.recentMaterials ?? []).map(materialToCardItem)}
        linkHref={`${basePath}/materials`}
        linkLabel="View all"
        emptyText="No materials uploaded yet"
      />
    </div>
  );
}
