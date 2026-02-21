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

export type AssessmentKind =
  | 'observation'
  | 'professional_discussion'
  | 'reflective_account'
  | 'verbal_assessment'
  | 'written_assessment'
  | 'work_product'
  | 'witness_testimony';

export type AssessmentStatus = 'draft' | 'published';
export type SignOffRole = 'assessor' | 'iqa' | 'eqa' | 'learner';
export type SignOffStatus = 'pending' | 'signed_off' | 'rejected';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  centreId: string;
}

// Phase 2: Assessment list item (from GET /api/v2/assessments)
export interface AssessmentListItem {
  _id: string;
  title: string;
  date: string;
  assessmentKind: AssessmentKind | null;
  status: AssessmentStatus;
  learnerId: { _id: string; name: string; email: string };
  assessorId: string;
  enrollmentId: { _id: string; cohortId: string };
  qualificationId: string;
  criteriaCount: number;
  signOffs: Array<{ role: SignOffRole; status: SignOffStatus }>;
  createdAt: string;
  updatedAt: string;
}

// Phase 2: Criteria tree types (from GET /api/v2/qualifications/[id]/criteria-tree)
export interface CriteriaTreeAC {
  _id: string;
  acNumber: string;
  description: string;
}

export interface CriteriaTreeLO {
  _id: string;
  loNumber: string;
  description: string;
  assessmentCriteria: CriteriaTreeAC[];
}

export interface CriteriaTreeUnit {
  _id: string;
  unitReference: string;
  title: string;
  learningOutcomes: CriteriaTreeLO[];
}

// Phase 2: Full assessment detail (from GET /api/v2/assessments/[id])
export interface CriteriaMapEntry {
  _id: string;
  criteriaId: {
    _id: string;
    acNumber: string;
    description: string;
    unitId: { _id: string; unitReference: string; title: string };
    learningOutcomeId: { _id: string; loNumber: string; description: string };
  };
}

export interface EvidenceMapEntry {
  _id: string;
  evidenceId: {
    _id: string;
    fileName: string;
    fileType: string;
    label: string;
    description: string;
    status: string;
  };
}

export interface SignOffEntry {
  _id: string;
  role: SignOffRole;
  status: SignOffStatus;
  signedOffBy: { _id: string; name: string; email: string } | null;
  signedOffAt: string | null;
  comments: string;
}

export interface RemarkEntry {
  _id: string;
  content: string;
  createdBy: { _id: string; name: string; email: string };
  createdAt: string;
}

export interface FullAssessmentDetail {
  assessment: AssessmentListItem;
  criteriaMap: CriteriaMapEntry[];
  evidenceMap: EvidenceMapEntry[];
  signOffs: SignOffEntry[];
  remarks: RemarkEntry[];
}

// Phase 3: Progress types
export interface ProgressAssessment {
  _id: string;
  title: string;
  date: string;
  assessmentKind: AssessmentKind | null;
  status: AssessmentStatus;
}

export interface ProgressAC {
  _id: string;
  acNumber: string;
  description: string;
  isMet: boolean;
  linkedAssessments: ProgressAssessment[];
}

export interface ProgressLO {
  _id: string;
  loNumber: string;
  description: string;
  assessmentCriteria: ProgressAC[];
  metCount: number;
  totalCount: number;
}

export interface ProgressUnit {
  _id: string;
  unitReference: string;
  title: string;
  learningOutcomes: ProgressLO[];
  metCount: number;
  totalCount: number;
}

// Phase 4: File manager types
export interface FileItem {
  _id: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  storageProvider?: 'local' | 's3';
  storageBucket?: string;
  storageKey?: string;
  isFolder: boolean;
  folderId: string | null;
  uploadedBy: { _id: string; name: string; email: string };
  createdAt: string;
  updatedAt: string;
}

export interface FolderBreadcrumb {
  _id: string | null;
  name: string;
}

export interface MaterialItem extends FileItem {
  title: string;
  category: string;
  description: string;
}

// Phase 4: Work hours types
export interface WorkHourEntryItem {
  _id: string;
  enrollmentId: string;
  learnerId: { _id: string; name: string; email: string };
  date: string;
  hours: number;
  minutes: number;
  notes: string;
  recordedBy: { _id: string; name: string; email: string };
  createdAt: string;
}

// Phase 3: Portfolio types
export interface PortfolioEvidence {
  _id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileUrl: string;
  storageProvider?: 'local' | 's3';
  storageBucket?: string;
  storageKey?: string;
  label: string;
  description: string;
  status: EvidenceStatus;
  uploadedAt: string;
  attemptNumber: number;
  unitId: { _id: string; unitReference: string; title: string } | null;
}

// Phase 5: Home dashboard types
export interface DashboardAssessor {
  _id: string;
  name: string;
  email: string;
  learnerCount: number;
}

export interface DashboardLearner {
  _id: string;
  name: string;
  email: string;
  enrollmentId: string;
  status: EnrolmentStatus;
  cohortId: string;
}

export interface RecentAssessmentItem {
  _id: string;
  title: string;
  date: string;
  assessmentKind: AssessmentKind | null;
  status: AssessmentStatus;
  learnerName: string;
}

export interface RecentEvidenceItem {
  _id: string;
  fileName: string;
  label: string;
  status: EvidenceStatus;
  uploadedAt: string;
  learnerName: string;
}

export interface RecentMaterialItem {
  _id: string;
  title: string;
  category: string;
  fileType: string;
  createdAt: string;
}

export interface AssessorHomeDashboard {
  assessors: DashboardAssessor[];
  learners: DashboardLearner[];
  recentAssessments: RecentAssessmentItem[];
  recentEvidence: RecentEvidenceItem[];
  recentMaterials: RecentMaterialItem[];
}

// Phase 5: Members page types
export interface TeamMember {
  _id: string;
  name: string;
  email: string;
  role: string;
}

export interface LearnerGroupItem {
  enrollmentId: string;
  learnerId: string;
  name: string;
  email: string;
  status: EnrolmentStatus;
}

export interface LearnerGroup {
  cohortId: string;
  learners: LearnerGroupItem[];
}

export interface MembersData {
  teamMembers: TeamMember[];
  learnerGroups: LearnerGroup[];
}

// Phase 5: Search types
export interface SearchResultMember {
  _id: string;
  name: string;
  email: string;
  role: string;
  enrollmentId?: string;
}

export interface SearchResultAssessment {
  _id: string;
  title: string;
  date: string;
  assessmentKind: AssessmentKind | null;
  learnerName: string;
}

export interface SearchResultEvidence {
  _id: string;
  fileName: string;
  label: string;
  learnerName: string;
}

export interface SearchResults {
  members: SearchResultMember[];
  assessments: SearchResultAssessment[];
  evidence: SearchResultEvidence[];
}

// Phase 5: Course selector type
export interface AssessorCourse {
  _id: string;
  title: string;
  slug: string;
  code: string;
  level: number;
  learnerCount: number;
}
