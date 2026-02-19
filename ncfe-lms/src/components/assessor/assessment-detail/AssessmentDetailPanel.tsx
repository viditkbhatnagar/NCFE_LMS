'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAutoSave } from '@/hooks/useAutoSave';
import DetailHeader from './DetailHeader';
import AssessmentKindSelector from './AssessmentKindSelector';
import PlanSection from './PlanSection';
import EvidenceMappingSection from './EvidenceMappingSection';
import CriteriaMappingSection from './CriteriaMappingSection';
import SignOffStatusSection from './SignOffStatusSection';
import RemarksSection from './RemarksSection';
import type {
  AssessmentKind,
  AssessmentStatus,
  CriteriaMapEntry,
  EvidenceMapEntry,
  SignOffEntry,
  RemarkEntry,
  UserRole,
} from '@/types';

interface AssessmentDetailPanelProps {
  assessmentId: string;
  qualificationId: string;
  enrollmentId: string;
  readOnly?: boolean;
  userRole?: UserRole;
  onClose: () => void;
  onDeleted: () => void;
  onUpdated: () => void;
}

interface EditState {
  title: string;
  date: string;
  assessmentKind: AssessmentKind | null;
  planIntent: string;
  planImplementation: string;
  status: AssessmentStatus;
  [key: string]: unknown;
}

export default function AssessmentDetailPanel({
  assessmentId,
  qualificationId,
  enrollmentId,
  readOnly = false,
  userRole = 'assessor',
  onClose,
  onDeleted,
  onUpdated,
}: AssessmentDetailPanelProps) {
  const [loading, setLoading] = useState(true);
  const [editState, setEditState] = useState<EditState>({
    title: '',
    date: '',
    assessmentKind: null,
    planIntent: '',
    planImplementation: '',
    status: 'draft',
  });
  const [criteriaMap, setCriteriaMap] = useState<CriteriaMapEntry[]>([]);
  const [evidenceMap, setEvidenceMap] = useState<EvidenceMapEntry[]>([]);
  const [signOffs, setSignOffs] = useState<SignOffEntry[]>([]);
  const [remarks, setRemarks] = useState<RemarkEntry[]>([]);

  // Auto-save hook
  const { saveStatus, scheduleUpdate, setSaveStatus } = useAutoSave<EditState>({
    saveFn: async (updates) => {
      if (readOnly) return true;
      try {
        const res = await fetch(`/api/v2/assessments/${assessmentId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });
        const json = await res.json();
        if (json.success) {
          onUpdated();
          return true;
        }
        return false;
      } catch {
        return false;
      }
    },
    flushUrl: `/api/v2/assessments/${assessmentId}`,
  });

  // Fetch full assessment detail
  const fetchDetail = useCallback(async () => {
    try {
      const res = await fetch(`/api/v2/assessments/${assessmentId}`);
      const json = await res.json();
      if (json.success) {
        const { assessment, criteriaMap: cm, evidenceMap: em, signOffs: so, remarks: rm } = json.data;
        setEditState({
          title: assessment.title || '',
          date: assessment.date || '',
          assessmentKind: assessment.assessmentKind,
          planIntent: assessment.planIntent || '',
          planImplementation: assessment.planImplementation || '',
          status: assessment.status,
        });
        setCriteriaMap(cm);
        setEvidenceMap(em);
        setSignOffs(so);
        setRemarks(rm);
      }
    } catch (err) {
      console.error('Error fetching assessment detail:', err);
    } finally {
      setLoading(false);
    }
  }, [assessmentId]);

  useEffect(() => {
    setLoading(true);
    fetchDetail();
  }, [fetchDetail]);

  // Field update handlers — no-op when readOnly
  const updateField = <K extends keyof EditState>(key: K, value: EditState[K]) => {
    if (readOnly) return;
    setEditState((prev) => ({ ...prev, [key]: value }));
    scheduleUpdate({ [key]: value } as Partial<EditState>);
  };

  // Publish handler
  const handlePublish = async () => {
    if (readOnly) return;
    try {
      const res = await fetch(`/api/v2/assessments/${assessmentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'published' }),
      });
      const json = await res.json();
      if (json.success) {
        setEditState((prev) => ({ ...prev, status: 'published' }));
        setSaveStatus('saved');
        onUpdated();
      }
    } catch (err) {
      console.error('Error publishing assessment:', err);
    }
  };

  // Delete handler
  const handleDelete = async () => {
    if (readOnly) return;
    if (!window.confirm('Delete this assessment? This action cannot be undone.')) return;

    try {
      const res = await fetch(`/api/v2/assessments/${assessmentId}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.success) {
        onDeleted();
      } else {
        alert(json.error || 'Failed to delete assessment');
      }
    } catch (err) {
      console.error('Error deleting assessment:', err);
    }
  };

  // Re-fetch callbacks for sub-sections
  const refreshDetail = () => fetchDetail();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <DetailHeader
        date={editState.date}
        title={editState.title}
        signOffs={signOffs}
        saveStatus={saveStatus}
        status={editState.status}
        readOnly={readOnly}
        onDateChange={(date) => updateField('date', date)}
        onTitleChange={(title) => updateField('title', title)}
        onPublish={handlePublish}
        onDelete={handleDelete}
        onClose={onClose}
      />

      {/* Scrollable sections */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        {/* Section 1: Assessment Kind */}
        <AssessmentKindSelector
          value={editState.assessmentKind}
          onChange={(kind) => updateField('assessmentKind', kind)}
          readOnly={readOnly}
        />

        {/* Section 2: Plan Intent */}
        <PlanSection
          label="Plan Intent"
          value={editState.planIntent}
          onChange={(value) => updateField('planIntent', value)}
          readOnly={readOnly}
        />

        {/* Section 3: Plan Implementation */}
        <PlanSection
          label="Plan Implementation"
          value={editState.planImplementation}
          onChange={(value) => updateField('planImplementation', value)}
          readOnly={readOnly}
        />

        {/* Divider */}
        <hr className="border-gray-100" />

        {/* Section 4: Evidence Mapping */}
        <EvidenceMappingSection
          assessmentId={assessmentId}
          enrollmentId={enrollmentId}
          evidenceMap={evidenceMap}
          onUpdated={refreshDetail}
          readOnly={readOnly}
        />

        {/* Section 5: Criteria Mapping */}
        <CriteriaMappingSection
          assessmentId={assessmentId}
          qualificationId={qualificationId}
          criteriaMap={criteriaMap}
          onUpdated={refreshDetail}
          readOnly={readOnly}
        />

        {/* Divider */}
        <hr className="border-gray-100" />

        {/* Section 6: Sign-off Status */}
        <SignOffStatusSection
          signOffs={signOffs}
          assessmentId={assessmentId}
          onSignOff={refreshDetail}
          userRole={userRole}
        />

        {/* Divider */}
        <hr className="border-gray-100" />

        {/* Section 7: Remarks */}
        <RemarksSection
          remarks={remarks}
          assessmentId={assessmentId}
          onAdded={refreshDetail}
        />
      </div>
    </div>
  );
}
