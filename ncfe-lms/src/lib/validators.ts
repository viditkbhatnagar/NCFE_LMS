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
