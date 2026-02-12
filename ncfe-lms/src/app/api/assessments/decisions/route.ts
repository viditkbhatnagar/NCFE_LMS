import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import { createAuditLog } from '@/lib/audit';
import { assessmentDecisionSchema } from '@/lib/validators';
import AssessmentDecision from '@/models/AssessmentDecision';
import Submission from '@/models/Submission';

export async function POST(request: Request) {
  try {
    const { session, error } = await withAuth(['assessor']);

    if (error) {
      return error;
    }

    const body = await request.json();

    // Validate input
    const validation = assessmentDecisionSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { submissionId, decisions } = validation.data;

    await dbConnect();

    // Verify submission exists and is assigned to this assessor
    const submission = await Submission.findById(submissionId);

    if (!submission) {
      return NextResponse.json(
        { success: false, error: 'Submission not found' },
        { status: 404 }
      );
    }

    if (submission.assessorId?.toString() !== session!.user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: not the assigned assessor' },
        { status: 403 }
      );
    }

    // Validate VASC constraints: if decision is 'met', all VASC must be true
    for (const d of decisions) {
      if (d.decision === 'met') {
        if (!d.vascValid || !d.vascAuthentic || !d.vascSufficient || !d.vascCurrent) {
          return NextResponse.json(
            {
              success: false,
              error: `Decision "met" for AC ${d.assessmentCriteriaId} requires all VASC fields to be true`,
            },
            { status: 400 }
          );
        }
      }
    }

    // Upsert decisions: for each AC, update existing or create new
    const createdDecisions = [];

    for (const d of decisions) {
      const decisionDoc = await AssessmentDecision.findOneAndUpdate(
        {
          submissionId,
          assessmentCriteriaId: d.assessmentCriteriaId,
        },
        {
          submissionId,
          assessmentCriteriaId: d.assessmentCriteriaId,
          decision: d.decision,
          assessorId: session!.user.id,
          learnerId: submission.learnerId,
          unitId: submission.unitId,
          vascValid: d.vascValid,
          vascAuthentic: d.vascAuthentic,
          vascSufficient: d.vascSufficient,
          vascCurrent: d.vascCurrent,
          notes: d.notes || '',
          decisionDate: new Date(),
        },
        { upsert: true, new: true, runValidators: true }
      );

      createdDecisions.push(decisionDoc);

      await createAuditLog({
        userId: session!.user.id,
        action: 'assessment_decision_created',
        entityType: 'AssessmentDecision',
        entityId: decisionDoc._id.toString(),
        newValue: {
          decision: d.decision,
          assessmentCriteriaId: d.assessmentCriteriaId,
          vascValid: d.vascValid,
          vascAuthentic: d.vascAuthentic,
          vascSufficient: d.vascSufficient,
          vascCurrent: d.vascCurrent,
        },
      });
    }

    return NextResponse.json(
      { success: true, data: createdDecisions },
      { status: 201 }
    );
  } catch (err) {
    console.error('Error creating assessment decisions:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
