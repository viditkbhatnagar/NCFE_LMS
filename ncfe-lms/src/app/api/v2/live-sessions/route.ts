import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import { createAuditLog } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';
import { sendLiveSessionScheduledEmail } from '@/lib/email';
import LiveSession from '@/models/LiveSession';
import Enrolment from '@/models/Enrolment';
import Qualification from '@/models/Qualification';
import User from '@/models/User';
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

  // Notify the enrolled learners + assessor(s) in scope. Emails fire once on
  // creation — there are no "starts soon" reminders by design. Soft-fail all
  // notify work so a flaky Brevo / DB query doesn't block the creation.
  try {
    const enrolFilter: Record<string, unknown> = {
      qualificationId: data.qualificationId,
    };
    if (data.cohortId) enrolFilter.cohortId = data.cohortId;
    const enrolments = await Enrolment.find(enrolFilter)
      .select('userId assessorId')
      .lean();

    // Recipients = enrolled students + every distinct assessor on those
    // enrolments, minus the user who just created the session (they don't
    // need to email themselves).
    const studentIds = new Set<string>();
    const assessorIds = new Set<string>();
    for (const e of enrolments) {
      if (e.userId) studentIds.add(String(e.userId));
      if (e.assessorId) assessorIds.add(String(e.assessorId));
    }
    studentIds.delete(session!.user.id);
    assessorIds.delete(session!.user.id);

    const qualification = await Qualification.findById(data.qualificationId)
      .select('title')
      .lean();
    const qualTitle = qualification?.title || 'your course';
    const scheduledDate = new Date(data.scheduledAt);
    const durationMinutes = data.durationMinutes ?? 60;

    // In-app notification — students AND assessor(s).
    const allRecipients = new Set([...studentIds, ...assessorIds]);
    for (const userId of allRecipients) {
      createNotification({
        userId,
        type: 'live_session_scheduled',
        title: 'New live class scheduled',
        message: `${data.title} — ${scheduledDate.toLocaleString()}`,
        entityType: 'LiveSession',
        entityId: String(created._id),
      });
    }

    // Email — fetch user details for everyone in one query, then send.
    const users = await User.find({
      _id: { $in: [...allRecipients] },
      status: 'active',
    })
      .select('name email')
      .lean();
    for (const u of users) {
      const kind: 'student' | 'assessor' = assessorIds.has(String(u._id))
        ? 'assessor'
        : 'student';
      sendLiveSessionScheduledEmail({
        recipientName: u.name,
        recipientEmail: u.email,
        recipientKind: kind,
        sessionTitle: data.title,
        qualificationTitle: qualTitle,
        scheduledAt: scheduledDate,
        durationMinutes,
        meetingLink: data.meetingLink,
      }).catch((err) => console.warn('live-session email failed:', err));
    }
  } catch (err) {
    console.warn('live-session notify failed:', err);
  }

  return NextResponse.json({ success: true, data: created }, { status: 201 });
}
