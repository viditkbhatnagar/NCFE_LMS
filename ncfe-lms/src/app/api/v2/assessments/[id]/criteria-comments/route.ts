import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import { criterionCommentCreateSchema } from '@/lib/validators';
import { createAuditLog } from '@/lib/audit';
import Assessment from '@/models/Assessment';
import CriterionComment from '@/models/CriterionComment';

interface PopulatedRef {
  _id?: { toString(): string };
  toString(): string;
}

function refId(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  const ref = value as PopulatedRef;
  return ref._id?.toString() ?? ref.toString();
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { session, error } = await withAuth(['assessor', 'student', 'iqa', 'admin']);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const criteriaId = searchParams.get('criteriaId');

    await dbConnect();

    const assessment = await Assessment.findById(id).lean();
    if (!assessment) {
      return NextResponse.json(
        { success: false, error: 'Assessment not found' },
        { status: 404 }
      );
    }

    const role = session!.user.role;
    const userId = session!.user.id;

    if (role === 'student') {
      if (refId(assessment.learnerId) !== userId) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
      }
    } else if (role === 'assessor') {
      if (refId(assessment.assessorId) !== userId) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
      }
    }

    const filter: Record<string, unknown> = { assessmentId: id };
    if (criteriaId) filter.criteriaId = criteriaId;

    const comments = await CriterionComment.find(filter)
      .populate('createdBy', 'name email role')
      .sort({ createdAt: 1 })
      .lean();

    return NextResponse.json({ success: true, data: comments });
  } catch (err) {
    console.error('Error listing criterion comments:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { session, error } = await withAuth(['assessor', 'iqa']);
    if (error) return error;

    const body = await request.json();
    const validation = criterionCommentCreateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, errors: validation.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    await dbConnect();

    const assessment = await Assessment.findById(id).lean();
    if (!assessment) {
      return NextResponse.json(
        { success: false, error: 'Assessment not found' },
        { status: 404 }
      );
    }

    if (
      session!.user.role === 'assessor' &&
      refId(assessment.assessorId) !== session!.user.id
    ) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const comment = await CriterionComment.create({
      assessmentId: id,
      criteriaId: validation.data.criteriaId,
      content: validation.data.content,
      createdBy: session!.user.id,
    });

    await createAuditLog({
      userId: session!.user.id,
      action: 'CRITERION_COMMENT_ADDED',
      entityType: 'Assessment',
      entityId: id,
      newValue: { commentId: comment._id.toString(), criteriaId: validation.data.criteriaId },
    });

    const populated = await CriterionComment.findById(comment._id)
      .populate('createdBy', 'name email role')
      .lean();

    return NextResponse.json({ success: true, data: populated }, { status: 201 });
  } catch (err) {
    console.error('Error creating criterion comment:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
