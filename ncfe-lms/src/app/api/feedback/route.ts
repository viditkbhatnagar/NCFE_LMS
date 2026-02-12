import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import { createAuditLog } from '@/lib/audit';
import { feedbackSchema } from '@/lib/validators';
import Feedback from '@/models/Feedback';
import Submission from '@/models/Submission';

export async function POST(request: Request) {
  try {
    const { session, error } = await withAuth(['assessor']);

    if (error) {
      return error;
    }

    const body = await request.json();

    // Validate input
    const validation = feedbackSchema.safeParse(body);

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

    const { submissionId, strengths, gaps, actionsRequired, isResubmissionRequired } =
      validation.data;

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

    // Create feedback
    const feedback = await Feedback.create({
      submissionId,
      assessorId: session!.user.id,
      learnerId: submission.learnerId,
      strengths,
      gaps: gaps || '',
      actionsRequired: actionsRequired || '',
      isResubmissionRequired,
    });

    // If resubmission required, update submission status
    if (isResubmissionRequired) {
      submission.status = 'resubmission_required';
      await submission.save();
    }

    await createAuditLog({
      userId: session!.user.id,
      action: 'feedback_created',
      entityType: 'Feedback',
      entityId: feedback._id.toString(),
      newValue: {
        submissionId,
        isResubmissionRequired,
      },
    });

    return NextResponse.json(
      { success: true, data: feedback },
      { status: 201 }
    );
  } catch (err) {
    console.error('Error creating feedback:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
