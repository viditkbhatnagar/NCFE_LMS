import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { auth } from '@/lib/auth';
import LiveSession from '@/models/LiveSession';
import Enrolment from '@/models/Enrolment';
import User from '@/models/User';
import Qualification from '@/models/Qualification';
import { sendLiveSessionReminderEmail } from '@/lib/email';
import { createNotification } from '@/lib/notifications';

// GET /api/cron/live-session-reminders
//
// Run by an external cron (Render Cron Service, cron-job.org, GitHub Actions
// scheduled workflow — whichever you wire up). The endpoint is idempotent:
// every session whose scheduledAt is in the next 60 minutes and that has not
// already had its reminder batch sent gets emailed exactly once.
//
// Auth: an admin session, OR `?key=<CRON_SECRET>` matching the env var.
// Set CRON_SECRET in Render to a long random string; the cron URL becomes
//   https://ncfe-lms.onrender.com/api/cron/live-session-reminders?key=…
// Suggested schedule: every 5 minutes.

const WINDOW_MINUTES = 60;

export async function GET(req: NextRequest) {
  // Auth check — either admin session or matching secret.
  const session = await auth();
  const isAdmin = session?.user && (session.user as { role?: string }).role === 'admin';
  const providedKey = req.nextUrl.searchParams.get('key');
  const expectedKey = process.env.CRON_SECRET;
  const keyOk = !!expectedKey && providedKey === expectedKey;

  if (!isAdmin && !keyOk) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();

  const now = new Date();
  const cutoff = new Date(now.getTime() + WINDOW_MINUTES * 60_000);

  const due = await LiveSession.find({
    status: 'scheduled',
    scheduledAt: { $gt: now, $lte: cutoff },
    $or: [{ remindersSentAt: { $exists: false } }, { remindersSentAt: null }],
  }).lean();

  const summary: Array<{
    sessionId: string;
    title: string;
    notified: number;
    failed: number;
  }> = [];

  for (const s of due) {
    const enrolFilter: Record<string, unknown> = {
      qualificationId: s.qualificationId,
    };
    if (s.cohortId) enrolFilter.cohortId = s.cohortId;

    const enrolments = await Enrolment.find(enrolFilter).select('userId').lean();
    const userIds = enrolments
      .map((e) => e.userId)
      .filter((u): u is NonNullable<typeof u> => !!u);

    const [users, qualification] = await Promise.all([
      User.find({ _id: { $in: userIds }, status: 'active' })
        .select('name email')
        .lean(),
      Qualification.findById(s.qualificationId).select('title').lean(),
    ]);

    let notified = 0;
    let failed = 0;
    const minutesUntil = Math.round(
      (new Date(s.scheduledAt).getTime() - now.getTime()) / 60_000,
    );

    for (const u of users) {
      try {
        const result = await sendLiveSessionReminderEmail({
          recipientName: u.name,
          recipientEmail: u.email,
          sessionTitle: s.title,
          qualificationTitle: qualification?.title || 'your course',
          scheduledAt: new Date(s.scheduledAt),
          meetingLink: s.meetingLink,
          minutesUntil: Math.max(1, minutesUntil),
        });
        if (result.ok) notified += 1;
        else failed += 1;

        // In-app reminder too — the bell badge brings them in even without email.
        createNotification({
          userId: String(u._id),
          type: 'live_session_reminder',
          title: 'Live class starts soon',
          message: `${s.title} — in ${minutesUntil} minute${minutesUntil === 1 ? '' : 's'}`,
          entityType: 'LiveSession',
          entityId: String(s._id),
        });
      } catch (err) {
        console.warn('live-session reminder send failed:', err);
        failed += 1;
      }
    }

    await LiveSession.findByIdAndUpdate(s._id, { remindersSentAt: now });
    summary.push({ sessionId: String(s._id), title: s.title, notified, failed });
  }

  return NextResponse.json({
    success: true,
    data: {
      ranAt: now.toISOString(),
      windowMinutes: WINDOW_MINUTES,
      sessionsProcessed: summary.length,
      summary,
    },
  });
}
