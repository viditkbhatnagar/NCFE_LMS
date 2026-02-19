'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAssessorCourse } from '@/contexts/AssessorCourseContext';
import ProgressSummaryCard from '@/components/assessor/ProgressSummaryCard';
import ProgressColumn from '@/components/assessor/ProgressColumn';
import UnitCard from '@/components/assessor/UnitCard';
import OutcomeCard from '@/components/assessor/OutcomeCard';
import CriterionCard from '@/components/assessor/CriterionCard';
import ProgressAssessmentItem from '@/components/assessor/ProgressAssessmentItem';
import type { ProgressUnit } from '@/types';

interface ProgressData {
  units: ProgressUnit[];
  summary: { metCount: number; totalCount: number };
}

export default function ProgressPage() {
  const { currentEnrollmentId, userRole } = useAssessorCourse();

  const [data, setData] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [selectedLOId, setSelectedLOId] = useState<string | null>(null);
  const [selectedACId, setSelectedACId] = useState<string | null>(null);

  // Reset drill-down selections when learner changes
  useEffect(() => {
    setSelectedUnitId(null);
    setSelectedLOId(null);
    setSelectedACId(null);
    setData(null);
  }, [currentEnrollmentId]);

  const fetchProgress = useCallback(async () => {
    if (!currentEnrollmentId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v2/progress/${currentEnrollmentId}`);
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch (err) {
      console.error('Error fetching progress:', err);
    } finally {
      setLoading(false);
    }
  }, [currentEnrollmentId]);

  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  // No learner selected
  if (!currentEnrollmentId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400">
        <svg
          className="w-16 h-16 mb-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
        <p className="text-lg font-medium text-gray-500 mb-1">
          {userRole === 'student'
            ? 'No enrollment found for this course'
            : 'Select a learner to view their progress'}
        </p>
        {userRole !== 'student' && (
          <p className="text-sm text-gray-400">
            Use the learner dropdown in the top bar
          </p>
        )}
      </div>
    );
  }

  // Derive selected items from data
  const selectedUnit =
    data?.units.find((u) => u._id === selectedUnitId) ?? null;
  const selectedLO =
    selectedUnit?.learningOutcomes.find((lo) => lo._id === selectedLOId) ??
    null;
  const selectedAC =
    selectedLO?.assessmentCriteria.find((ac) => ac._id === selectedACId) ??
    null;

  return (
    <div className="flex flex-col h-full p-6 pb-2">
      {/* Summary card */}
      {data && (
        <ProgressSummaryCard
          metCount={data.summary.metCount}
          totalCount={data.summary.totalCount}
        />
      )}

      {/* 4-column layout — horizontal scroll on narrow viewports */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex h-full min-w-[900px] bg-white border border-gray-200 rounded-lg overflow-hidden">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Column 1: Units */}
              <ProgressColumn
                title="Units"
                itemCount={data?.units.length}
              >
                {(data?.units ?? []).map((unit) => (
                  <UnitCard
                    key={unit._id}
                    unit={unit}
                    isSelected={selectedUnitId === unit._id}
                    onClick={() => {
                      setSelectedUnitId(unit._id);
                      setSelectedLOId(null);
                      setSelectedACId(null);
                    }}
                  />
                ))}
              </ProgressColumn>

              {/* Column 2: Learning Outcomes */}
              <ProgressColumn
                title="Outcomes"
                itemCount={selectedUnit?.learningOutcomes.length}
                isEmpty={!selectedUnit}
                emptyMessage="Select a unit to see outcomes"
              >
                {(selectedUnit?.learningOutcomes ?? []).map((lo) => (
                  <OutcomeCard
                    key={lo._id}
                    lo={lo}
                    isSelected={selectedLOId === lo._id}
                    onClick={() => {
                      setSelectedLOId(lo._id);
                      setSelectedACId(null);
                    }}
                  />
                ))}
              </ProgressColumn>

              {/* Column 3: Assessment Criteria */}
              <ProgressColumn
                title="Criteria"
                itemCount={selectedLO?.assessmentCriteria.length}
                isEmpty={!selectedLO}
                emptyMessage="Select an outcome"
              >
                {(selectedLO?.assessmentCriteria ?? []).map((ac) => (
                  <CriterionCard
                    key={ac._id}
                    ac={ac}
                    isSelected={selectedACId === ac._id}
                    onClick={() => setSelectedACId(ac._id)}
                  />
                ))}
              </ProgressColumn>

              {/* Column 4: Linked Assessments */}
              <ProgressColumn
                title="Assessments"
                itemCount={selectedAC?.linkedAssessments.length}
                isEmpty={!selectedAC}
                emptyMessage="Select a criterion"
              >
                {selectedAC &&
                selectedAC.linkedAssessments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-gray-300">
                    <p className="text-xs text-center">
                      No published assessments cover this criterion yet
                    </p>
                  </div>
                ) : (
                  (selectedAC?.linkedAssessments ?? []).map((a) => (
                    <ProgressAssessmentItem
                      key={a._id}
                      assessment={a}
                    />
                  ))
                )}
              </ProgressColumn>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
