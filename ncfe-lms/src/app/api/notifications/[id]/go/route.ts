import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import Notification from '@/models/Notification';
import Assessment from '@/models/Assessment';
import Evidence from '@/models/Evidence';
import Enrolment from '@/models/Enrolment';
import Qualification from '@/models/Qualification';
import LiveSession from '@/models/LiveSession';

// Server-side notification click resolver.
//
// The notification bell can't reliably build a target URL on the client —
// it depends on the current path containing a /c/{slug}/ segment, which
// fails whenever the user is on /c, /dashboard, or the notifications page
// itself. This route resolves the entity → course → slug server-side and
// 307-redirects, so a click always lands somewhere sensible.

async function slugForQualification(qualificationId: unknown): Promise<string | null> {
  if (!qualificationId) return null;
  const q = await Qualification.findById(qualificationId).select('slug').lean();
  return q?.slug ?? null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { session, error } = await withAuth();
  if (error) return error;

  await dbConnect();

  const notif = await Notification.findById(id);
  // Fall back to a safe landing page rather than erroring on a bad id.
  const fallback = session!.user.role === 'admin' ? '/admin/dashboard'
    : session!.user.role === 'iqa' ? '/iqa/dashboard'
    : '/c';

  if (!notif || String(notif.userId) !== session!.user.id) {
    return NextResponse.redirect(new URL(fallback, _req.url), 307);
  }

  // Mark read on the way through.
  if (!notif.isRead) {
    notif.isRead = true;
    await notif.save();
  }

  let target = fallback;
  try {
    const entityType = notif.entityType;
    const entityId = notif.entityId ? String(notif.entityId) : null;

    if (entityType === 'Assessment' && entityId) {
      const a = await Assessment.findById(entityId).select('qualificationId').lean();
      const slug = await slugForQualification(a?.qualificationId);
      if (slug) target = `/c/${slug}/assessment?id=${entityId}`;
    } else if (entityType === 'Evidence' && entityId) {
      const ev = await Evidence.findById(entityId).select('enrolmentId').lean();
      if (ev?.enrolmentId) {
        const enr = await Enrolment.findById(ev.enrolmentId).select('qualificationId').lean();
        const slug = await slugForQualification(enr?.qualificationId);
        if (slug) target = `/c/${slug}/portfolio`;
      }
    } else if (entityType === 'LiveSession' && entityId) {
      const ls = await LiveSession.findById(entityId).select('qualificationId').lean();
      const slug = await slugForQualification(ls?.qualificationId);
      if (slug) target = `/c/${slug}/live-sessions`;
    } else if (entityType === 'Submission' && entityId) {
      // Legacy submission flow lives outside the BRITEthink dashboard.
      target = `/submissions/${entityId}/feedback`;
    } else if (notif.type?.startsWith('sign_off') || notif.type?.startsWith('assessment')) {
      // Type-based fallback when entityType is missing but the type implies an assessment.
      if (entityId) {
        const a = await Assessment.findById(entityId).select('qualificationId').lean();
        const slug = await slugForQualification(a?.qualificationId);
        if (slug) target = `/c/${slug}/assessment?id=${entityId}`;
      }
    }
  } catch (err) {
    console.warn('notification-go: resolution failed, using fallback', err);
  }

  return NextResponse.redirect(new URL(target, _req.url), 307);
}
