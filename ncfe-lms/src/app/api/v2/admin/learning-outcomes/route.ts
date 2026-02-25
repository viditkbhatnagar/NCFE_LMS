import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import { createAuditLog } from '@/lib/audit';
import LearningOutcome from '@/models/LearningOutcome';
import { learningOutcomeCreateSchema } from '@/lib/validators';

export async function GET(req: NextRequest) {
  const { error } = await withAuth(['admin']);
  if (error) return error;

  await dbConnect();

  const unitId = req.nextUrl.searchParams.get('unitId');
  if (!unitId) {
    return NextResponse.json({ success: false, error: 'unitId is required' }, { status: 400 });
  }

  const los = await LearningOutcome.find({ unitId }).sort({ loNumber: 1 }).lean();

  return NextResponse.json({ success: true, data: los });
}

export async function POST(req: NextRequest) {
  const { session, error } = await withAuth(['admin']);
  if (error) return error;

  await dbConnect();

  const body = await req.json();
  const validation = learningOutcomeCreateSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { success: false, errors: validation.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const lo = await LearningOutcome.create(validation.data);

  await createAuditLog({
    userId: session!.user.id,
    action: 'LEARNING_OUTCOME_CREATED',
    entityType: 'LearningOutcome',
    entityId: String(lo._id),
    newValue: validation.data,
  });

  return NextResponse.json({ success: true, data: lo }, { status: 201 });
}
