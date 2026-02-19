'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAssessorCourse } from '@/contexts/AssessorCourseContext';
import AssessmentCard from '@/components/assessor/AssessmentCard';
import LearnerSelectionModal from '@/components/assessor/LearnerSelectionModal';
import AssessmentDetailPanel from '@/components/assessor/assessment-detail/AssessmentDetailPanel';
import { groupByTimePeriod } from '@/lib/assessment-utils';
import type { AssessmentListItem } from '@/types';

export default function AssessmentsPage() {
  const { qualification, enrollments, currentEnrollmentId, selectedLearner, userRole } =
    useAssessorCourse();

  const readOnly = userRole === 'student';

  const [assessments, setAssessments] = useState<AssessmentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string | null>(null);
  const [showLearnerModal, setShowLearnerModal] = useState(false);
  const [creating, setCreating] = useState(false);

  const fetchAssessments = useCallback(async () => {
    setLoading(true);
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
      const json = await res.json();
      if (json.success) {
        setAssessments(json.data);
      }
    } catch (err) {
      console.error('Error fetching assessments:', err);
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

        {/* Loading state */}
        {loading && (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Empty state */}
        {!loading && assessments.length === 0 && (
          <div className="flex flex-col items-center py-16 text-gray-400">
            <svg className="w-16 h-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            <p className="text-lg font-medium text-gray-500 mb-2">
              {readOnly ? 'No assessments available' : 'No assessments yet'}
            </p>
            <p className="text-sm text-gray-400 mb-4">
              {readOnly
                ? 'Your assessor has not yet created any assessments for you'
                : 'Create your first assessment to get started'}
            </p>
            {!readOnly && (
              <button
                onClick={handleCreate}
                disabled={creating}
                className="px-4 py-2 bg-primary text-white rounded-[6px] text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                + Create an Assessment
              </button>
            )}
          </div>
        )}

        {/* Card grid grouped by time */}
        {!loading &&
          groups.map((group) => (
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
      </div>

      {/* Right: Detail panel — full-screen on mobile, inline on desktop */}
      {selectedAssessmentId && panelEnrollmentId && (
        <div className="fixed inset-0 z-50 bg-white lg:relative lg:inset-auto lg:z-auto lg:w-[420px] lg:border-l lg:border-gray-200 h-full overflow-hidden shrink-0">
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
