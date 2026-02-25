import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import { createAuditLog } from '@/lib/audit';
import AssessmentCriteria from '@/models/AssessmentCriteria';
import { assessmentCriteriaAdminCreateSchema } from '@/lib/validators';

export async function GET(req: NextRequest) {
  const { error } = await withAuth(['admin']);
  if (error) return error;

  await dbConnect();

  const { searchParams } = req.nextUrl;
  const learningOutcomeId = searchParams.get('learningOutcomeId');
  const unitId = searchParams.get('unitId');

  const filter: Record<string, unknown> = {};
  if (learningOutcomeId) filter.learningOutcomeId = learningOutcomeId;
  else if (unitId) filter.unitId = unitId;
  else {
    return NextResponse.json(
      { success: false, error: 'learningOutcomeId or unitId is required' },
      { status: 400 }
    );
  }

  const criteria = await AssessmentCriteria.find(filter).sort({ acNumber: 1 }).lean();

  return NextResponse.json({ success: true, data: criteria });
}

export async function POST(req: NextRequest) {
  const { session, error } = await withAuth(['admin']);
  if (error) return error;

  await dbConnect();

  const body = await req.json();
  const validation = assessmentCriteriaAdminCreateSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { success: false, errors: validation.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const ac = await AssessmentCriteria.create(validation.data);

  await createAuditLog({
    userId: session!.user.id,
    action: 'ASSESSMENT_CRITERIA_CREATED',
    entityType: 'AssessmentCriteria',
    entityId: String(ac._id),
    newValue: validation.data,
  });

  return NextResponse.json({ success: true, data: ac }, { status: 201 });
}
