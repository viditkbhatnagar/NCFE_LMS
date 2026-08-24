'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAutoSave } from '@/hooks/useAutoSave';
import ConfirmDialog from '@/components/admin/ConfirmDialog';
import DetailHeader from './DetailHeader';
import AssessmentKindSelector from './AssessmentKindSelector';
import PlanSection from './PlanSection';
import EvidenceMappingSection from './EvidenceMappingSection';
import CriteriaMappingSection from './CriteriaMappingSection';
import SignOffStatusSection from './SignOffStatusSection';
import RemarksSection from './RemarksSection';
import LearnerSelectionModal from '@/components/assessor/LearnerSelectionModal';
import { useAssessorCourse } from '@/contexts/AssessorCourseContext';
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
  const [loadError, setLoadError] = useState<string | null>(null);
  // Tracks whether the panel ever loaded successfully. fetchDetail doubles as
  // the refresh path for the sub-sections, so a transient failure there must
  // not replace an already-populated panel with an error screen.
  const [loaded, setLoaded] = useState(false);
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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // canEdit comes from the detail GET: false when viewing another assessor's
  // assessment (or as an oversight role). Combined with the incoming readOnly
  // prop, it gates every write affordance in the panel. Starts false so a
  // failed load never leaves live Sign Off / Delete buttons on a blank panel.
  const [canEdit, setCanEdit] = useState(false);
  const effectiveReadOnly = readOnly || !canEdit;
  // Duplicating creates a fresh draft under the current user, so a non-owning
  // assessor keeps it even when the panel is read-only — but IQAs and learners
  // never can.
  const canDuplicate = userRole === 'assessor' || userRole === 'admin';
  const { enrollments } = useAssessorCourse();
  const [showDuplicate, setShowDuplicate] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [confirmAssignAll, setConfirmAssignAll] = useState(false);
  const [assigningAll, setAssigningAll] = useState(false);

  // Auto-save hook
  const { saveStatus, scheduleUpdate, setSaveStatus } = useAutoSave<EditState>({
    saveFn: async (updates) => {
      if (effectiveReadOnly) return true;
      try {
        const res = await fetch(`/api/v2/assessments/${assessmentId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });
        const json = await res.json();
        if (json.success) {
          // Sync status from server (e.g. published → published_modified)
          if (json.data?.status) {
            setEditState((prev) => ({ ...prev, status: json.data.status }));
          }
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
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success) {
        const { assessment, criteriaMap: cm, evidenceMap: em, signOffs: so, remarks: rm } = json.data;
        setCanEdit(json.data.canEdit ?? true);
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
        setLoadError(null);
        setLoaded(true);
      } else {
        // Deliberately does NOT clear canEdit: fetchDetail is also the refresh
        // path for four sub-sections, so a transient blip after a remark or a
        // sign-off would silently strip every write control from an owning
        // assessor with no visible explanation. canEdit starts false, which is
        // what protects the initial-load case.
        setLoadError(json?.error || 'Failed to load this assessment.');
      }
    } catch (err) {
      console.error('Error fetching assessment detail:', err);
      setLoadError('Network error. Check your connection and retry.');
    } finally {
      setLoading(false);
    }
  }, [assessmentId]);

  useEffect(() => {
    setLoading(true);
    setLoaded(false);
    setLoadError(null);
    // Reset here rather than in fetchDetail's failure arms, so switching to a
    // different assessment starts locked while a refresh of the current one
    // leaves the open panel's controls alone.
    setCanEdit(false);
    fetchDetail();
  }, [fetchDetail]);

  // Field update handlers — no-op when readOnly
  const updateField = <K extends keyof EditState>(key: K, value: EditState[K]) => {
    if (effectiveReadOnly) return;
    setEditState((prev) => ({ ...prev, [key]: value }));
    scheduleUpdate({ [key]: value } as Partial<EditState>);
  };

  // Publish handler
  const handlePublish = async () => {
    if (effectiveReadOnly) return;
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

  // Delete handler — opens ConfirmDialog instead of native window.confirm
  const handleDelete = () => {
    if (effectiveReadOnly) return;
    setConfirmDelete(true);
  };

  const performDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/v2/assessments/${assessmentId}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.success) {
        setConfirmDelete(false);
        onDeleted();
      } else {
        alert(json.error || 'Failed to delete assessment');
      }
    } catch (err) {
      console.error('Error deleting assessment:', err);
    } finally {
      setDeleting(false);
    }
  };

  // Re-fetch callbacks for sub-sections
  const refreshDetail = () => fetchDetail();

  // Duplicate this assessment's plan onto another learner (creates a fresh draft
  // owned by the current assessor). Allowed even when viewing read-only.
  const handleDuplicate = async (target: { _id: string; userId?: { _id: string } }) => {
    if (duplicating) return;
    setDuplicating(true);
    try {
      const res = await fetch(`/api/v2/assessments/${assessmentId}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enrollmentId: target._id, learnerId: target.userId?._id }),
      });
      const json = await res.json();
      if (json.success) {
        setShowDuplicate(false);
        onUpdated();
      } else {
        alert(json.error || 'Failed to duplicate assessment');
      }
    } catch {
      alert('Failed to duplicate assessment');
    } finally {
      setDuplicating(false);
    }
  };

  // Assign this assessment's plan to every learner on the course (fan-out).
  const handleAssignAll = async () => {
    if (assigningAll) return;
    setAssigningAll(true);
    try {
      const res = await fetch(`/api/v2/assessments/${assessmentId}/assign-all`, { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        setConfirmAssignAll(false);
        alert(`Assigned to ${json.data?.count ?? 0} learner(s).`);
        onUpdated();
      } else {
        alert(json.error || 'Failed to assign to all learners');
      }
    } catch {
      alert('Failed to assign to all learners');
    } finally {
      setAssigningAll(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Only when the initial load failed — a refresh blip on a loaded panel keeps
  // the panel on screen.
  if (loadError && !loaded) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm text-gray-600">{loadError}</p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchDetail()}
            className="px-3 py-1 text-xs font-medium text-gray-700 border border-gray-300 rounded-[6px] hover:bg-gray-50"
          >
            Retry
          </button>
          <button
            onClick={onClose}
            className="px-3 py-1 text-xs font-medium text-gray-700 border border-gray-300 rounded-[6px] hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <DetailHeader
        date={editState.date}
        title={editState.title}
        assessmentId={assessmentId}
        signOffs={signOffs}
        saveStatus={saveStatus}
        status={editState.status}
        readOnly={effectiveReadOnly}
        onDateChange={(date) => updateField('date', date)}
        onTitleChange={(title) => updateField('title', title)}
        onPublish={handlePublish}
        onDelete={handleDelete}
        onClose={onClose}
        onDuplicate={canDuplicate ? () => setShowDuplicate(true) : undefined}
        onAssignAll={() => setConfirmAssignAll(true)}
      />

      {/* Scrollable sections */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        {/* Section 1: Assessment Kind */}
        <AssessmentKindSelector
          value={editState.assessmentKind}
          onChange={(kind) => updateField('assessmentKind', kind)}
          readOnly={effectiveReadOnly}
        />

        {/* Section 2: Plan Intent */}
        <PlanSection
          label="Plan Intent"
          value={editState.planIntent}
          onChange={(value) => updateField('planIntent', value)}
          readOnly={effectiveReadOnly}
        />

        {/* Section 3: Plan Implementation */}
        <PlanSection
          label="Plan Implementation"
          value={editState.planImplementation}
          onChange={(value) => updateField('planImplementation', value)}
          readOnly={effectiveReadOnly}
        />

        {/* Divider */}
        <hr className="border-gray-100" />

        {/* Section 4: Evidence Mapping.
            Learners may attach/detach their OWN evidence here even though the
            rest of the panel is read-only for them — they only ever see their
            own assessment, and the API ownership-checks every change. Criteria
            mapping + sign-off below stay assessor-only (assessor judgement). */}
        <EvidenceMappingSection
          assessmentId={assessmentId}
          enrollmentId={enrollmentId}
          evidenceMap={evidenceMap}
          onUpdated={refreshDetail}
          readOnly={effectiveReadOnly && userRole !== 'student'}
        />

        {/* Section 5: Criteria Mapping */}
        <CriteriaMappingSection
          assessmentId={assessmentId}
          qualificationId={qualificationId}
          criteriaMap={criteriaMap}
          onUpdated={refreshDetail}
          readOnly={effectiveReadOnly}
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
        {/* IQAs give feedback via remarks too, even though the rest of the
            panel is read-only for them. */}
        <RemarksSection
          remarks={remarks}
          assessmentId={assessmentId}
          onAdded={refreshDetail}
          readOnly={effectiveReadOnly && userRole !== 'iqa'}
        />
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this assessment?"
        message="This permanently removes the assessment and all linked criteria mappings, evidence mappings, sign-offs, remarks, and notifications. This cannot be undone."
        confirmLabel="Delete assessment"
        destructive
        loading={deleting}
        onConfirm={performDelete}
        onCancel={() => setConfirmDelete(false)}
      />

      <LearnerSelectionModal
        isOpen={showDuplicate}
        onClose={() => setShowDuplicate(false)}
        enrollments={enrollments}
        onSelect={(enr) => handleDuplicate(enr)}
      />

      <ConfirmDialog
        open={confirmAssignAll}
        title="Assign to all learners?"
        message="This creates a copy of this assessment for every active learner on the course, each under their own assessor. Existing copies are not affected."
        confirmLabel="Assign to all"
        loading={assigningAll}
        onConfirm={handleAssignAll}
        onCancel={() => setConfirmAssignAll(false)}
      />
    </div>
  );
}
