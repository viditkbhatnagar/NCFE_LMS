import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import { createAuditLog } from '@/lib/audit';
import LearningOutcome from '@/models/LearningOutcome';
import { learningOutcomeUpdateSchema } from '@/lib/validators';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await withAuth(['admin']);
  if (error) return error;

  await dbConnect();

  const { id } = await params;
  const body = await req.json();
  const validation = learningOutcomeUpdateSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { success: false, errors: validation.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const old = await LearningOutcome.findById(id).lean();
  if (!old) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }

  const updated = await LearningOutcome.findByIdAndUpdate(id, validation.data, { new: true });

  await createAuditLog({
    userId: session!.user.id,
    action: 'LEARNING_OUTCOME_UPDATED',
    entityType: 'LearningOutcome',
    entityId: id,
    oldValue: old as unknown as Record<string, unknown>,
    newValue: validation.data,
  });

  return NextResponse.json({ success: true, data: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await withAuth(['admin']);
  if (error) return error;

  await dbConnect();

  const { id } = await params;
  const lo = await LearningOutcome.findById(id);
  if (!lo) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }

  await LearningOutcome.findByIdAndDelete(id);

  await createAuditLog({
    userId: session!.user.id,
    action: 'LEARNING_OUTCOME_DELETED',
    entityType: 'LearningOutcome',
    entityId: id,
  });

  return NextResponse.json({ success: true });
}
