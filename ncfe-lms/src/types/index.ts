export type UserRole = 'student' | 'assessor' | 'iqa' | 'admin';
export type UserStatus = 'active' | 'inactive';
export type EnrolmentStatus = 'enrolled' | 'in_progress' | 'completed' | 'withdrawn';
export type EvidenceStatus = 'draft' | 'submitted' | 'assessed';
export type EvidenceMappingStatus = 'active' | 'superseded';
export type SubmissionStatus = 'submitted' | 'under_review' | 'assessed' | 'resubmission_required';
export type AssessmentDecisionType = 'met' | 'not_yet_met';
export type IQADecisionType = 'approved' | 'action_required' | 'reassessment_required';
export type IQAStage = 'early' | 'mid' | 'late';
export type IQASampleStatus = 'pending' | 'reviewed' | 'completed';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  centreId: string;
}
