'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAssessorCourse } from '@/contexts/AssessorCourseContext';
import AssessmentCard from '@/components/assessor/AssessmentCard';
import LearnerSelectionModal from '@/components/assessor/LearnerSelectionModal';
import AssessmentDetailPanel from '@/components/assessor/assessment-detail/AssessmentDetailPanel';
import { groupByTimePeriod } from '@/lib/assessment-utils';
import type { AssessmentListItem } from '@/types';
import ListStateBoundary, {
  DefaultListSkeleton,
  EmptyState,
} from '@/components/common/ListStateBoundary';

export default function AssessmentsPage() {
  const { qualification, enrollments, currentEnrollmentId, selectedLearner, userRole } =
    useAssessorCourse();

  const readOnly = userRole === 'student';

  const SIDEBAR_W = 65;
  const TOP_NAV_H = 56;
  const MIN_PANEL_W = 380;

  const [assessments, setAssessments] = useState<AssessmentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string | null>(null);
  const [showLearnerModal, setShowLearnerModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [panelW, setPanelW] = useState<number | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);

  // Detect desktop breakpoint
  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Drag-to-resize handler
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startW = panelW ?? window.innerWidth - SIDEBAR_W;

      const onMove = (ev: MouseEvent) => {
        const dx = startX - ev.clientX;
        const newW = Math.max(MIN_PANEL_W, Math.min(window.innerWidth - SIDEBAR_W, startW + dx));
        setPanelW(newW);
      };

      const onUp = () => {
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };

      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [panelW],
  );

  const fetchAssessments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let url: string;
      if (readOnly) {
        url = `/api/v2/student/assessments?qualificationId=${qualification._id}`;
      } else {
        const params = new URLSearchParams({ qualificationId: qualification._id });
        if (currentEnrollmentId) params.set('enrollmentId', currentEnrollmentId);
        url = `/api/v2/assessments?${params}`;
      }

      const res = await fetch(url);
      if (!res.ok) {
        setError('The server returned an error. Please try again.');
        return;
      }
      const json = await res.json();
      if (json.success) {
        setAssessments(json.data);
      } else {
        setError(json.error || 'Failed to load assessments.');
      }
    } catch (err) {
      console.error('Error fetching assessments:', err);
      setError('Network error. Check your connection and retry.');
    } finally {
      setLoading(false);
    }
  }, [qualification._id, currentEnrollmentId, readOnly]);

  useEffect(() => {
    fetchAssessments();
  }, [fetchAssessments]);

  const createAssessment = async (enrollmentId: string, learnerId: string) => {
    setCreating(true);
    try {
      const res = await fetch('/api/v2/assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ learnerId, enrollmentId }),
      });
      const json = await res.json();
      if (json.success) {
        setAssessments((prev) => [json.data, ...prev]);
        setSelectedAssessmentId(json.data._id);
      }
    } catch (err) {
      console.error('Error creating assessment:', err);
    } finally {
      setCreating(false);
      setShowLearnerModal(false);
    }
  };

  const handleCreate = () => {
    if (currentEnrollmentId && selectedLearner) {
      createAssessment(currentEnrollmentId, selectedLearner._id);
    } else {
      setShowLearnerModal(true);
    }
  };

  const handleDeleted = () => {
    setAssessments((prev) => prev.filter((a) => a._id !== selectedAssessmentId));
    setSelectedAssessmentId(null);
  };

  const groups = groupByTimePeriod(assessments);

  // Find the selected assessment to get its enrollmentId
  const selectedAssessment = assessments.find((a) => a._id === selectedAssessmentId);
  const panelEnrollmentId =
    typeof selectedAssessment?.enrollmentId === 'object'
      ? selectedAssessment.enrollmentId._id
      : selectedAssessment?.enrollmentId || currentEnrollmentId || undefined;

  return (
    <div className="flex h-full">
      {/* Left: Assessment list */}
      <div
        className={`flex-1 overflow-y-auto p-6 transition-all ${
          selectedAssessmentId ? 'pr-2' : ''
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Assessments</h1>
          {!readOnly && (
            <button
              onClick={handleCreate}
              disabled={creating}
              className="px-4 py-2 bg-primary text-white rounded-[6px] text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {creating ? 'Creating...' : '+ Create an Assessment'}
            </button>
          )}
        </div>

        <ListStateBoundary
          loading={loading}
          error={error}
          isEmpty={assessments.length === 0}
          onRetry={fetchAssessments}
          skeleton={<DefaultListSkeleton rows={4} />}
          emptyContent={
            <EmptyState
              title={readOnly ? 'No assessments available' : 'No assessments yet'}
              description={
                readOnly
                  ? 'Your assessor has not yet created any assessments for you.'
                  : 'Create your first assessment to plan units, capture evidence, and sign off.'
              }
              cta={
                !readOnly ? (
                  <button
                    onClick={handleCreate}
                    disabled={creating}
                    className="px-4 py-2 bg-primary text-white rounded-[6px] text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    + Create an assessment
                  </button>
                ) : null
              }
            />
          }
        >
          {/* Card grid grouped by time */}
          {groups.map((group) => (
            <div key={group.label} className="mb-6">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                {group.label}
              </h2>
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {group.items.map((assessment) => (
                  <AssessmentCard
                    key={assessment._id}
                    assessment={assessment}
                    isSelected={selectedAssessmentId === assessment._id}
                    onClick={() => setSelectedAssessmentId(assessment._id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </ListStateBoundary>
      </div>

      {/* Right: Detail panel — full-screen on mobile, overlay on desktop */}
      {selectedAssessmentId && panelEnrollmentId && (
        <div
          ref={panelRef}
          className="fixed z-40 bg-white overflow-hidden"
          style={
            isDesktop
              ? { top: TOP_NAV_H, right: 0, bottom: 0, width: panelW ?? `calc(100vw - ${SIDEBAR_W}px)` }
              : { inset: 0 }
          }
        >
          {/* Resize handle (desktop only) */}
          {isDesktop && (
            <div
              className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/20 active:bg-primary/30 z-10 transition-colors"
              onMouseDown={handleResizeStart}
            />
          )}
          <AssessmentDetailPanel
            key={selectedAssessmentId}
            assessmentId={selectedAssessmentId}
            qualificationId={qualification._id}
            enrollmentId={panelEnrollmentId}
            readOnly={readOnly}
            userRole={userRole}
            onClose={() => setSelectedAssessmentId(null)}
            onDeleted={handleDeleted}
            onUpdated={fetchAssessments}
          />
        </div>
      )}

      {/* Learner selection modal */}
      {!readOnly && (
        <LearnerSelectionModal
          isOpen={showLearnerModal}
          onClose={() => setShowLearnerModal(false)}
          enrollments={enrollments}
          onSelect={(enrollment) => {
            createAssessment(enrollment._id, enrollment.userId._id);
          }}
        />
      )}
    </div>
  );
}
