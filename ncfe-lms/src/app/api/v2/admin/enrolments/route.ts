import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import { createAuditLog } from '@/lib/audit';
import Enrolment from '@/models/Enrolment';
import '@/models/User';
import '@/models/Qualification';
import { adminEnrolmentCreateSchema } from '@/lib/validators';

export async function GET(req: NextRequest) {
  const { error } = await withAuth(['admin']);
  if (error) return error;

  await dbConnect();

  const { searchParams } = req.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
  const qualificationId = searchParams.get('qualificationId');
  const status = searchParams.get('status');
  const assessorId = searchParams.get('assessorId');

  const filter: Record<string, unknown> = {};
  if (qualificationId) filter.qualificationId = qualificationId;
  if (status) filter.status = status;
  if (assessorId) filter.assessorId = assessorId;

  const [enrolments, total] = await Promise.all([
    Enrolment.find(filter)
      .populate('userId', 'name email')
      .populate('qualificationId', 'title code')
      .populate('assessorId', 'name email')
      .sort({ enrolledAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Enrolment.countDocuments(filter),
  ]);

  return NextResponse.json({
    success: true,
    data: enrolments,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function POST(req: NextRequest) {
  const { session, error } = await withAuth(['admin']);
  if (error) return error;

  await dbConnect();

  const body = await req.json();
  const validation = adminEnrolmentCreateSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { success: false, errors: validation.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  // Check for duplicate enrolment
  const existing = await Enrolment.findOne({
    userId: validation.data.userId,
    qualificationId: validation.data.qualificationId,
  });
  if (existing) {
    return NextResponse.json(
      { success: false, error: 'This student is already enrolled in this course' },
      { status: 409 }
    );
  }

  const enrolment = await Enrolment.create({
    ...validation.data,
    enrolledAt: new Date(),
  });

  await createAuditLog({
    userId: session!.user.id,
    action: 'ENROLMENT_CREATED',
    entityType: 'Enrolment',
    entityId: String(enrolment._id),
    newValue: validation.data,
  });

  return NextResponse.json({ success: true, data: enrolment }, { status: 201 });
}
