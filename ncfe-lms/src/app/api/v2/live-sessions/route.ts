import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import { createAuditLog } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';
import LiveSession from '@/models/LiveSession';
import Enrolment from '@/models/Enrolment';
import Qualification from '@/models/Qualification';
import { liveSessionCreateSchema } from '@/lib/validators';

// GET /api/v2/live-sessions?qualificationId=X
// Returns { sessions, cohorts }. Students only see sessions for their own
// cohort (or all-cohort sessions); assessor/admin see everything.
export async function GET(req: NextRequest) {
  const { session, error } = await withAuth(['assessor', 'student', 'admin']);
  if (error) return error;

  await dbConnect();

  const qualificationId = req.nextUrl.searchParams.get('qualificationId');
  const user = session!.user;

  // No qualificationId → cross-course view.
  //  - Admin sees every session.
  //  - Student sees every session for any course they're enrolled in,
  //    scoped to their own cohort(s) plus all-cohort sessions.
  //  - Assessor: requires qualificationId (their per-course page handles it).
  if (!qualificationId) {
    if (user.role === 'admin') {
      const sessions = await LiveSession.find({})
        .sort({ scheduledAt: -1 })
        .lean();
      const qids = Array.from(new Set(sessions.map((s) => String(s.qualificationId))));
      const quals = await Qualification.find({ _id: { $in: qids } })
        .select('title slug code')
        .lean();
      const byId = new Map(
        quals.map((q) => [String(q._id), { title: q.title, slug: q.slug, code: q.code }]),
      );
      return NextResponse.json({
        success: true,
        data: sessions.map((s) => ({
          ...s,
          qualification: byId.get(String(s.qualificationId)) ?? null,
        })),
      });
    }

    if (user.role === 'student') {
      const myEnrolments = await Enrolment.find({ userId: user.id })
        .select('qualificationId cohortId')
        .lean();
      if (myEnrolments.length === 0) {
        return NextResponse.json({ success: true, data: [] });
      }
      const qids = myEnrolments.map((e) => e.qualificationId);
      const myCohorts = Array.from(
        new Set(myEnrolments.map((e) => e.cohortId).filter((c): c is string => !!c)),
      );
      const sessions = await LiveSession.find({
        qualificationId: { $in: qids },
        cohortId: { $in: ['', ...myCohorts] },
      })
        .sort({ scheduledAt: -1 })
        .lean();
      const quals = await Qualification.find({ _id: { $in: qids } })
        .select('title slug code')
        .lean();
      const byId = new Map(
        quals.map((q) => [String(q._id), { title: q.title, slug: q.slug, code: q.code }]),
      );
      return NextResponse.json({
        success: true,
        data: sessions.map((s) => ({
          ...s,
          qualification: byId.get(String(s.qualificationId)) ?? null,
        })),
      });
    }

    return NextResponse.json(
      { success: false, error: 'qualificationId is required' },
      { status: 400 },
    );
  }

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
    recordingLink: data.recordingLink || undefined,
    // If a recording link is provided up front, mark the session as completed
    // (typical case: admin schedules a past session retroactively + paste link).
    status: data.recordingLink ? 'completed' : 'scheduled',
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
