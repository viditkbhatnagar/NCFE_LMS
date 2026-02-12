import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import { createAuditLog } from '@/lib/audit';
import Submission from '@/models/Submission';

const ALLOWED_STATUSES = ['under_review', 'assessed', 'resubmission_required'] as const;

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { session, error } = await withAuth(['assessor']);

    if (error) {
      return error;
    }

    const body = await request.json();
    const { status } = body;

    if (!status || !ALLOWED_STATUSES.includes(status)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid status. Allowed values: ${ALLOWED_STATUSES.join(', ')}`,
        },
        { status: 400 }
      );
    }

    await dbConnect();

    const submission = await Submission.findById(id);

    if (!submission) {
      return NextResponse.json(
        { success: false, error: 'Submission not found' },
        { status: 404 }
      );
    }

    // Only the assigned assessor can update status
    if (submission.assessorId?.toString() !== session!.user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: not the assigned assessor' },
        { status: 403 }
      );
    }

    const oldStatus = submission.status;
    submission.status = status;
    await submission.save();

    await createAuditLog({
      userId: session!.user.id,
      action: 'submission_status_updated',
      entityType: 'Submission',
      entityId: id,
      oldValue: { status: oldStatus },
      newValue: { status },
    });

    return NextResponse.json({
      success: true,
      data: submission,
    });
  } catch (err) {
    console.error('Error updating submission status:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
