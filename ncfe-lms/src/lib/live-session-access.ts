import mongoose from 'mongoose';
import Enrolment from '@/models/Enrolment';
import Qualification from '@/models/Qualification';
import { assessorMatch } from '@/lib/enrolment-access';
import type { SessionUser } from '@/types';

interface LiveSessionLike {
  qualificationId: mongoose.Types.ObjectId | string;
  cohortId?: string;
}

/**
 * Whether `user` may see a live session — and therefore its meeting link and
 * its recording. Mirrors the scoping the list endpoint (GET
 * /api/v2/live-sessions) applies, so a per-id fetch can't reach a session the
 * list would never have shown:
 *  - admin: every session
 *  - assessor: any session on a course they assess — either through an
 *    enrolment assignment or by being listed directly on the qualification
 *  - student: only sessions for a cohort they're enrolled on, plus
 *    all-cohort sessions
 *
 * IQA is deliberately absent — live sessions are hidden from IQA in the UI
 * (AssessorIconSidebar), so they get no access here either.
 */
export async function canAccessLiveSession(
  user: SessionUser,
  live: LiveSessionLike,
): Promise<boolean> {
  if (user.role === 'admin') return true;

  if (user.role === 'assessor') {
    // Course ownership is EITHER an enrolment-level assignment OR a direct
    // listing on the qualification — the same (a)-OR-(b) test /api/v2/assessor/
    // courses uses. Checking only (a) locks an assessor out of a recording they
    // uploaded themselves on a course that has no learners enrolled yet.
    const [byEnrolment, byQualification] = await Promise.all([
      Enrolment.exists({
        qualificationId: live.qualificationId,
        ...assessorMatch(user.id),
      }),
      Qualification.exists({
        _id: live.qualificationId,
        assessorIds: new mongoose.Types.ObjectId(user.id),
      }),
    ]);
    return !!(byEnrolment || byQualification);
  }

  if (user.role === 'student') {
    const myEnrolments = await Enrolment.find({
      userId: user.id,
      qualificationId: live.qualificationId,
    })
      .select('cohortId')
      .lean();
    if (myEnrolments.length === 0) return false;
    return !live.cohortId || myEnrolments.some((e) => e.cohortId === live.cohortId);
  }

  return false;
}
