import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  role: z.enum(['student', 'assessor', 'iqa', 'admin']).optional().default('student'),
});

export const signInSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const evidenceUploadSchema = z.object({
  enrolmentId: z.string().min(1, 'Enrolment ID is required'),
  unitId: z.string().min(1, 'Unit ID is required'),
  label: z.string().min(1, 'Evidence label is required'),
  description: z.string().optional(),
});

export const evidenceMappingSchema = z.object({
  evidenceId: z.string().min(1, 'Evidence ID is required'),
  assessmentCriteriaIds: z
    .array(z.string())
    .min(1, 'At least one Assessment Criteria must be mapped'),
});

export const assessmentDecisionSchema = z.object({
  submissionId: z.string().min(1),
  decisions: z.array(
    z.object({
      assessmentCriteriaId: z.string().min(1),
      decision: z.enum(['met', 'not_yet_met']),
      vascValid: z.boolean(),
      vascAuthentic: z.boolean(),
      vascSufficient: z.boolean(),
      vascCurrent: z.boolean(),
      notes: z.string().optional(),
    })
  ).min(1, 'At least one decision is required'),
});

export const feedbackSchema = z.object({
  submissionId: z.string().min(1),
  strengths: z.string().min(1, 'Strengths feedback is required'),
  gaps: z.string().optional(),
  actionsRequired: z.string().optional(),
  isResubmissionRequired: z.boolean(),
});

export const iqaSampleSchema = z.object({
  assessorId: z.string().min(1),
  learnerId: z.string().min(1),
  unitId: z.string().min(1),
  qualificationId: z.string().min(1),
  assessmentMethodsSampled: z.array(z.string()).min(1),
  stage: z.enum(['early', 'mid', 'late']),
});

export const iqaDecisionSchema = z.object({
  iqaSampleId: z.string().min(1),
  decision: z.enum(['approved', 'action_required', 'reassessment_required']),
  rationale: z.string().min(1, 'Rationale is required'),
  actionsForAssessor: z.string().optional(),
});

// BRITEthink Assessment validators
export const assessmentCreateSchema = z.object({
  title: z.string().optional().default(''),
  date: z.string().or(z.date()).optional(),
  assessmentKind: z
    .enum([
      'observation',
      'professional_discussion',
      'reflective_account',
      'verbal_assessment',
      'written_assessment',
      'work_product',
      'witness_testimony',
    ])
    .nullable()
    .optional()
    .default(null),
  planIntent: z.string().optional().default(''),
  planImplementation: z.string().optional().default(''),
  status: z.enum(['draft', 'published', 'published_modified']).optional().default('draft'),
  learnerId: z.string().min(1, 'Learner ID is required'),
  enrollmentId: z.string().min(1, 'Enrollment ID is required'),
});

export const signOffSchema = z.object({
  assessmentId: z.string().min(1),
  role: z.enum(['assessor', 'iqa', 'eqa', 'learner']),
  status: z.enum(['pending', 'signed_off', 'rejected']),
  comments: z.string().optional(),
});

export const remarkCreateSchema = z.object({
  assessmentId: z.string().min(1),
  content: z.string().min(1, 'Remark content is required'),
});

export const workHoursCreateSchema = z.object({
  enrollmentId: z.string().min(1),
  learnerId: z.string().min(1),
  date: z.string().or(z.date()),
  hours: z.number().int().min(0).max(24),
  minutes: z.number().int().min(0).max(59),
  notes: z.string().optional(),
});

// Phase 2: Assessment update (all fields optional, no learnerId/enrollmentId)
export const assessmentUpdateSchema = z.object({
  title: z.string().optional(),
  date: z.string().or(z.date()).optional(),
  assessmentKind: z
    .enum([
      'observation',
      'professional_discussion',
      'reflective_account',
      'verbal_assessment',
      'written_assessment',
      'work_product',
      'witness_testimony',
    ])
    .nullable()
    .optional(),
  planIntent: z.string().optional(),
  planImplementation: z.string().optional(),
  status: z.enum(['draft', 'published', 'published_modified']).optional(),
});

export const criteriaMappingUpdateSchema = z.object({
  criteriaIds: z.array(z.string()),
});

export const evidenceMappingUpdateSchema = z.object({
  evidenceIds: z.array(z.string()),
});

export const signOffActionSchema = z.object({
  role: z.enum(['assessor', 'iqa', 'eqa', 'learner']),
  status: z.enum(['signed_off', 'rejected']),
  comments: z.string().optional(),
});

export const remarkActionSchema = z.object({
  content: z.string().min(1, 'Remark content is required'),
});

// Phase 4: File manager validators
export const folderCreateSchema = z.object({
  fileName: z.string().min(1, 'Folder name is required').max(100),
  qualificationId: z.string().min(1),
  folderId: z.string().nullable().optional(),
});

export const fileRenameSchema = z.object({
  fileName: z.string().min(1, 'Name is required').max(200),
});

export const materialFolderCreateSchema = z.object({
  title: z.string().min(1, 'Folder name is required').max(100),
  qualificationId: z.string().min(1),
  folderId: z.string().nullable().optional(),
});

export const workHoursUpdateSchema = z.object({
  hours: z.number().int().min(0).max(24).optional(),
  minutes: z.number().int().min(0).max(59).optional(),
  notes: z.string().optional(),
  date: z.string().or(z.date()).optional(),
});

// ── Admin CRUD validators ────────────────────────────────────────────────────

export const qualificationCreateSchema = z.object({
  title: z.string().min(3, 'Title is required'),
  level: z.number().int().min(1).max(8),
  code: z.string().min(1, 'Qualification code is required'),
  awardingBody: z.string().optional().default('NCFE/CACHE'),
  description: z.string().optional().default(''),
  status: z.enum(['active', 'inactive']).optional().default('active'),
});

export const qualificationUpdateSchema = qualificationCreateSchema.partial();

export const unitCreateSchema = z.object({
  unitReference: z.string().min(1, 'Unit reference is required'),
  title: z.string().min(1, 'Unit title is required'),
  description: z.string().optional().default(''),
  qualificationId: z.string().min(1, 'Qualification ID is required'),
});

export const unitUpdateSchema = unitCreateSchema.partial().omit({ qualificationId: true });

export const learningOutcomeCreateSchema = z.object({
  unitId: z.string().min(1, 'Unit ID is required'),
  loNumber: z.string().min(1, 'LO number is required'),
  description: z.string().min(1, 'Description is required'),
});

export const learningOutcomeUpdateSchema = learningOutcomeCreateSchema.partial().omit({ unitId: true });

export const assessmentCriteriaAdminCreateSchema = z.object({
  learningOutcomeId: z.string().min(1),
  unitId: z.string().min(1),
  qualificationId: z.string().min(1),
  acNumber: z.string().min(1, 'AC number is required'),
  description: z.string().min(1, 'Description is required'),
  evidenceRequirements: z.string().optional().default(''),
});

export const assessmentCriteriaAdminUpdateSchema = assessmentCriteriaAdminCreateSchema
  .partial()
  .omit({ learningOutcomeId: true, unitId: true, qualificationId: true });

export const adminUserCreateSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['student', 'assessor', 'iqa', 'admin']),
  phone: z.string().optional(),
  status: z.enum(['active', 'inactive']).optional().default('active'),
});

export const adminUserUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  role: z.enum(['student', 'assessor', 'iqa', 'admin']).optional(),
  phone: z.string().optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

export const adminPasswordResetSchema = z.object({
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

export const adminEnrolmentCreateSchema = z.object({
  userId: z.string().min(1, 'Student ID is required'),
  qualificationId: z.string().min(1, 'Qualification ID is required'),
  assessorId: z.string().optional(),
  cohortId: z.string().optional(),
  status: z.enum(['enrolled', 'in_progress', 'completed', 'withdrawn']).optional().default('enrolled'),
});

export const adminEnrolmentUpdateSchema = z.object({
  assessorId: z.string().optional(),
  cohortId: z.string().optional(),
  status: z.enum(['enrolled', 'in_progress', 'completed', 'withdrawn']).optional(),
});
