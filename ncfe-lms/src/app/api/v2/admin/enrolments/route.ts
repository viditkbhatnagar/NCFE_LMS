import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import { createAuditLog } from '@/lib/audit';
import Enrolment from '@/models/Enrolment';
import User from '@/models/User';
import Qualification from '@/models/Qualification';
import { adminEnrolmentCreateSchema } from '@/lib/validators';
import { sendNewEnrolmentEmail } from '@/lib/email';
import { buildAssessorFields, assessorMatch } from '@/lib/enrolment-access';

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
  const userId = searchParams.get('userId');

  const filter: Record<string, unknown> = {};
  if (qualificationId) filter.qualificationId = qualificationId;
  if (status) filter.status = status;
  // Match either the lead assessorId or any secondary in assessorIds.
  if (assessorId) Object.assign(filter, assessorMatch(assessorId));
  if (userId) filter.userId = userId;

  const [enrolments, total] = await Promise.all([
    Enrolment.find(filter)
      .populate('userId', 'name email')
      .populate('qualificationId', 'title code')
      .populate('assessorId', 'name email')
      .populate('assessorIds', 'name email')
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

  // Multi-assessor: merge legacy single + new array, derive the lead.
  const { assessorIds, assessorId: leadAssessorId } = buildAssessorFields({
    assessorIds: validation.data.assessorIds,
    assessorId: validation.data.assessorId,
  });

  const enrolment = await Enrolment.create({
    ...validation.data,
    assessorIds,
    assessorId: leadAssessorId,
    enrolledAt: new Date(),
  });

  await createAuditLog({
    userId: session!.user.id,
    action: 'ENROLMENT_CREATED',
    entityType: 'Enrolment',
    entityId: String(enrolment._id),
    newValue: { ...validation.data, assessorIds },
  });

  // G7 — email the student + every assigned assessor (soft-fail, opt-out aware).
  void notifyEnrolment(
    validation.data.userId,
    validation.data.qualificationId,
    assessorIds,
    String(enrolment._id),
    session!.user.id,
  );

  return NextResponse.json({ success: true, data: enrolment }, { status: 201 });
}

async function notifyEnrolment(
  userId: string,
  qualificationId: string,
  assessorIds: string[],
  enrolmentId: string,
  adminUserId: string,
): Promise<void> {
  try {
    const [student, qualification, assessors] = await Promise.all([
      User.findById(userId).lean<{ name: string; email: string; role: string; notificationPreferences?: { newEnrolment?: boolean } } | null>(),
      Qualification.findById(qualificationId).lean<{ title: string } | null>(),
      assessorIds.length
        ? User.find({ _id: { $in: assessorIds } }).select('name').lean<{ name: string }[]>()
        : Promise.resolve([] as { name: string }[]),
    ]);
    if (!student || !qualification) return;
    if (student.role !== 'student') return;
    if (student.notificationPreferences?.newEnrolment === false) return;

    // The welcome email names all assigned assessors (comma-joined).
    const assessorName = assessors.map((a) => a.name).join(', ') || undefined;

    const result = await sendNewEnrolmentEmail({
      studentName: student.name,
      studentEmail: student.email,
      qualificationTitle: qualification.title,
      assessorName,
      loginUrl: `${process.env.APP_BASE_URL || ''}/sign-in`,
    });

    await createAuditLog({
      userId: adminUserId,
      action: result.ok ? 'EMAIL_SENT' : 'EMAIL_FAILED',
      entityType: 'Enrolment',
      entityId: enrolmentId,
      newValue: result.ok
        ? { template: 'new_enrolment', messageId: result.messageId, recipient: userId }
        : { template: 'new_enrolment', error: result.error, recipient: userId },
    });
  } catch (err) {
    console.warn('[notifyEnrolment] soft-fail:', err);
  }
}
