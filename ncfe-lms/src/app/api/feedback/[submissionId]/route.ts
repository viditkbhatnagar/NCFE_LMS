import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import Feedback from '@/models/Feedback';
import Submission from '@/models/Submission';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ submissionId: string }> }
) {
  try {
    const { submissionId } = await params;
    const { session, error } = await withAuth(['student', 'assessor', 'iqa']);

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

    // Access control: students can only see feedback for their own submissions
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

    const feedback = await Feedback.find({ submissionId })
      .populate('assessorId', 'name email')
      .sort({ createdAt: -1 });

    return NextResponse.json({
      success: true,
      data: feedback,
    });
  } catch (err) {
    console.error('Error fetching feedback:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
