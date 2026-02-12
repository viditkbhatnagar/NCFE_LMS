import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import AssessmentDecision from '@/models/AssessmentDecision';
import Submission from '@/models/Submission';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ submissionId: string }> }
) {
  try {
    const { submissionId } = await params;
    const { session, error } = await withAuth();

    if (error) {
      return error;
    }

    await dbConnect();

    // Verify submission exists
    const submission = await Submission.findById(submissionId);

    if (!submission) {
      return NextResponse.json(
        { success: false, error: 'Submission not found' },
        { status: 404 }
      );
    }

    // Access control: students can only see their own, assessors their assigned
    const user = session!.user;
    if (
      user.role === 'student' &&
      submission.learnerId?.toString() !== user.id
    ) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    const decisions = await AssessmentDecision.find({ submissionId })
      .populate('assessmentCriteriaId')
      .populate('assessorId', 'name email')
      .sort({ createdAt: 1 });

    return NextResponse.json({
      success: true,
      data: decisions,
    });
  } catch (err) {
    console.error('Error fetching assessment decisions:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
