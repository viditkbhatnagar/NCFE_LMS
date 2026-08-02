import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import Assessment from '@/models/Assessment';
import AssessmentCriteriaMap from '@/models/AssessmentCriteriaMap';
import SignOff from '@/models/SignOff';
import Enrolment from '@/models/Enrolment';
import User from '@/models/User';
import { assessorMatch } from '@/lib/enrolment-access';
import { createNotification } from '@/lib/notifications';
import type { SignOffRole } from '@/types';

const SIGN_OFF_ROLES: SignOffRole[] = ['assessor', 'iqa', 'eqa', 'learner'];

// POST /api/v2/assessments/[id]/assign-all
// "Assign to all learners": fans the source assessment's plan out to every
// active learner on the course as an individual copy (so each learner keeps
// their own evidence + sign-offs). All copies share an assignmentGroupId and are
// marked audience='all' so the UI can present them as one batch in the "All
// learners" folder. Each copy is owned by that learner's lead assessor.
// Optional body: { cohortId } to limit the fan-out to one cohort.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { session, error } = await withAuth(['assessor']);
    if (error) return error;

    const body = await request.json().catch(() => ({}));
    const cohortId: string | undefined = body?.cohortId || undefined;

    await dbConnect();

    const source = await Assessment.findById(id).lean();
    if (!source) {
      return NextResponse.json({ success: false, error: 'Source assessment not found' }, { status: 404 });
    }

    const userId = session!.user.id;
    // Caller must teach the source's course.
    const teaches =
      source.assessorId.toString() === userId ||
      !!(await Enrolment.exists({ qualificationId: source.qualificationId, ...assessorMatch(userId) }));
    if (!teaches) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const enrolFilter: Record<string, unknown> = {
      qualificationId: source.qualificationId,
      status: { $in: ['enrolled', 'in_progress'] },
    };
    if (cohortId) enrolFilter.cohortId = cohortId;
    const enrolments = await Enrolment.find(enrolFilter)
      .select('userId assessorId assessorIds cohortId')
      .lean();

    const targets = enrolments.filter((e) => e.userId);
    if (targets.length === 0) {
      return NextResponse.json({ success: false, error: 'No active learners to assign to' }, { status: 400 });
    }

    const groupId = new mongoose.Types.ObjectId();
    const srcMaps = await AssessmentCriteriaMap.find({ assessmentId: source._id })
      .select('criteriaId')
      .lean();

    const dbSession = await Assessment.startSession();
    let count = 0;
    try {
      dbSession.startTransaction();

      const copyDocs = targets.map((e) => ({
        title: source.title,
        date: source.date,
        assessmentKind: source.assessmentKind,
        planIntent: source.planIntent,
        planImplementation: source.planImplementation,
        status: 'draft' as const,
        publishCount: 0,
        learnerId: e.userId,
        // Each learner's copy is owned by their own lead assessor (fallback: the
        // caller) so it lands in the right assessor's workspace.
        assessorId: e.assessorId || (e.assessorIds && e.assessorIds[0]) || userId,
        enrollmentId: e._id,
        qualificationId: source.qualificationId,
        sourceAssessmentId: source._id,
        audience: 'all' as const,
        assignmentGroupId: groupId,
      }));

      const created = await Assessment.insertMany(copyDocs, { session: dbSession });
      count = created.length;

      const signOffDocs = created.flatMap((a) =>
        SIGN_OFF_ROLES.map((role) => ({ assessmentId: a._id, role, status: 'pending' as const })),
      );
      await SignOff.insertMany(signOffDocs, { session: dbSession });

      if (srcMaps.length > 0) {
        const criteriaDocs = created.flatMap((a) =>
          srcMaps.map((m) => ({ assessmentId: a._id, criteriaId: m.criteriaId })),
        );
        await AssessmentCriteriaMap.insertMany(criteriaDocs, { session: dbSession });
      }

      await dbSession.commitTransaction();

      // Best-effort notifications after commit.
      const assessor = await User.findById(userId, 'name').lean();
      const assessorName = assessor?.name || 'Your assessor';
      for (const a of created) {
        createNotification({
          userId: a.learnerId.toString(),
          type: 'assessment_created',
          title: 'New Assessment',
          message: `${assessorName} created a new assessment: ${source.title || 'Untitled'}`,
          entityType: 'Assessment',
          entityId: a._id.toString(),
        });
      }
    } catch (txErr) {
      await dbSession.abortTransaction();
      throw txErr;
    } finally {
      dbSession.endSession();
    }

    return NextResponse.json(
      { success: true, data: { assignmentGroupId: groupId.toString(), count } },
      { status: 201 },
    );
  } catch (err) {
    console.error('Error assigning assessment to all learners:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
