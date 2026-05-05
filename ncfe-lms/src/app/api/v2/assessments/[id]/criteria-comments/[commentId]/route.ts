import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import { createAuditLog } from '@/lib/audit';
import CriterionComment from '@/models/CriterionComment';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; commentId: string }> },
) {
  try {
    const { id, commentId } = await params;
    const { session, error } = await withAuth(['assessor', 'iqa', 'admin']);
    if (error) return error;

    await dbConnect();

    const comment = await CriterionComment.findById(commentId);
    if (!comment) {
      return NextResponse.json(
        { success: false, error: 'Comment not found' },
        { status: 404 }
      );
    }

    if (comment.assessmentId.toString() !== id) {
      return NextResponse.json(
        { success: false, error: 'Comment does not belong to this assessment' },
        { status: 400 }
      );
    }

    // Author-only delete (admin can also delete for moderation)
    if (
      session!.user.role !== 'admin' &&
      comment.createdBy.toString() !== session!.user.id
    ) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    await CriterionComment.findByIdAndDelete(commentId);

    await createAuditLog({
      userId: session!.user.id,
      action: 'CRITERION_COMMENT_DELETED',
      entityType: 'Assessment',
      entityId: id,
      oldValue: { commentId, criteriaId: comment.criteriaId.toString() },
    });

    return NextResponse.json({ success: true, data: { deleted: true } });
  } catch (err) {
    console.error('Error deleting criterion comment:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
