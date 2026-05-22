import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import { createAuditLog } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';
import LiveSession from '@/models/LiveSession';
import Enrolment from '@/models/Enrolment';
import { liveSessionCreateSchema } from '@/lib/validators';

// GET /api/v2/live-sessions?qualificationId=X
// Returns { sessions, cohorts }. Students only see sessions for their own
// cohort (or all-cohort sessions); assessor/admin see everything.
export async function GET(req: NextRequest) {
  const { session, error } = await withAuth(['assessor', 'student', 'admin']);
  if (error) return error;

  await dbConnect();

  const qualificationId = req.nextUrl.searchParams.get('qualificationId');
  if (!qualificationId) {
    return NextResponse.json(
      { success: false, error: 'qualificationId is required' },
      { status: 400 },
    );
  }

  const user = session!.user;
  const filter: Record<string, unknown> = { qualificationId };

  // Students are scoped to their cohort(s) + any all-cohort sessions.
  if (user.role === 'student') {
    const myEnrolments = await Enrolment.find({
      userId: user.id,
      qualificationId,
    })
      .select('cohortId')
      .lean();
    const myCohorts = myEnrolments
      .map((e) => e.cohortId)
      .filter((c): c is string => !!c);
    filter.cohortId = { $in: ['', ...myCohorts] };
  }

  const sessions = await LiveSession.find(filter)
    .sort({ scheduledAt: -1 })
    .lean();

  // Distinct cohorts on the course — used by the create form's cohort picker.
  const cohorts = (
    await Enrolment.distinct('cohortId', { qualificationId })
  ).filter((c): c is string => !!c);

  return NextResponse.json({
    success: true,
    data: sessions,
    cohorts,
  });
}

// POST /api/v2/live-sessions — admin or assessor creates a session.
export async function POST(req: NextRequest) {
  const { session, error } = await withAuth(['assessor', 'admin']);
  if (error) return error;

  await dbConnect();

  const body = await req.json();
  const validation = liveSessionCreateSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { success: false, errors: validation.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const data = validation.data;
  const created = await LiveSession.create({
    qualificationId: data.qualificationId,
    cohortId: data.cohortId || '',
    title: data.title,
    description: data.description || '',
    meetingLink: data.meetingLink,
    scheduledAt: new Date(data.scheduledAt),
    durationMinutes: data.durationMinutes ?? 60,
    createdBy: session!.user.id,
    status: 'scheduled',
  });

  await createAuditLog({
    userId: session!.user.id,
    action: 'LIVE_SESSION_CREATED',
    entityType: 'LiveSession',
    entityId: String(created._id),
    newValue: { title: data.title, cohortId: data.cohortId || '(all)' },
  });

  // Notify the enrolled learners in scope (soft-fail, fire-and-forget).
  try {
    const enrolFilter: Record<string, unknown> = {
      qualificationId: data.qualificationId,
    };
    if (data.cohortId) enrolFilter.cohortId = data.cohortId;
    const enrolments = await Enrolment.find(enrolFilter).select('userId').lean();
    for (const e of enrolments) {
      if (e.userId) {
        createNotification({
          userId: String(e.userId),
          type: 'live_session_scheduled',
          title: 'New live class scheduled',
          message: `${data.title} — ${new Date(data.scheduledAt).toLocaleString()}`,
          entityType: 'LiveSession',
          entityId: String(created._id),
        });
      }
    }
  } catch (err) {
    console.warn('live-session notify failed:', err);
  }

  return NextResponse.json({ success: true, data: created }, { status: 201 });
}
