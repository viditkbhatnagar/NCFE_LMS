import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { withAuth } from '@/lib/route-guard';
import { assessmentDuplicateSchema } from '@/lib/validators';
import Assessment from '@/models/Assessment';
import AssessmentCriteriaMap from '@/models/AssessmentCriteriaMap';
import SignOff from '@/models/SignOff';
import Enrolment from '@/models/Enrolment';
import User from '@/models/User';
import { isEnrolmentAssessor, assessorMatch } from '@/lib/enrolment-access';
import { createNotification } from '@/lib/notifications';
import type { SignOffRole } from '@/types';

// POST /api/v2/assessments/[id]/duplicate
// Duplicates the plan of an existing assessment onto ANOTHER learner. Copies
// title / kind / plan text (and criteria mapping when the target is the same
// qualification); resets status→draft, publishCount→0, fresh sign-offs; the new
// assessment is owned by the caller. Evidence, remarks and sign-offs are NOT
// copied — those are the source learner's work.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { session, error } = await withAuth(['assessor']);
    if (error) return error;

    const body = await request.json();
    const validation = assessmentDuplicateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    await dbConnect();

    const source = await Assessment.findById(id).lean();
    if (!source) {
      return NextResponse.json({ success: false, error: 'Source assessment not found' }, { status: 404 });
    }

    const userId = session!.user.id;

    // Caller must be allowed to SEE the source: the owning assessor, or an
    // assessor who teaches the source's course.
    const isOwner = source.assessorId.toString() === userId;
    const teachesSource =
      isOwner ||
      !!(await Enrolment.exists({ qualificationId: source.qualificationId, ...assessorMatch(userId) }));
    if (!teachesSource) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    // Target enrolment must exist and be one the caller assesses.
    const target = await Enrolment.findById(validation.data.enrollmentId);
    if (!target) {
      return NextResponse.json({ success: false, error: 'Target enrolment not found' }, { status: 404 });
    }
    if (!isEnrolmentAssessor(target, userId)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: that learner is not assigned to you' },
        { status: 403 },
      );
    }
    const targetLearnerId = validation.data.learnerId || target.userId?.toString();
    if (!targetLearnerId) {
      return NextResponse.json({ success: false, error: 'Target enrolment has no learner' }, { status: 400 });
    }

    const sameQualification = String(source.qualificationId) === String(target.qualificationId);

    const dbSession = await Assessment.startSession();
    let copyId: string;
    try {
      dbSession.startTransaction();

      const [copy] = await Assessment.create(
        [{
          title: source.title,
          date: source.date,
          assessmentKind: source.assessmentKind,
          planIntent: source.planIntent,
          planImplementation: source.planImplementation,
          status: 'draft',
          publishCount: 0,
          learnerId: targetLearnerId,
          assessorId: userId,
          enrollmentId: target._id,
          qualificationId: target.qualificationId,
          sourceAssessmentId: source._id,
        }],
        { session: dbSession },
      );
      copyId = String(copy._id);

      const roles: SignOffRole[] = ['assessor', 'iqa', 'eqa', 'learner'];
      await SignOff.insertMany(
        roles.map((role) => ({ assessmentId: copy._id, role, status: 'pending' })),
        { session: dbSession },
      );

      // Carry over criteria mapping only when the qualification matches (criteria
      // ids are qualification-scoped, so they'd be meaningless across courses).
      if (sameQualification) {
        const srcMaps = await AssessmentCriteriaMap.find({ assessmentId: source._id }).lean();
        if (srcMaps.length > 0) {
          await AssessmentCriteriaMap.insertMany(
            srcMaps.map((m) => ({ assessmentId: copy._id, criteriaId: m.criteriaId })),
            { session: dbSession },
          );
        }
      }

      await dbSession.commitTransaction();
    } catch (txErr) {
      await dbSession.abortTransaction();
      throw txErr;
    } finally {
      dbSession.endSession();
    }

    // Notify the new learner (best-effort).
    const assessor = await User.findById(userId, 'name').lean();
    createNotification({
      userId: targetLearnerId,
      type: 'assessment_created',
      title: 'New Assessment',
      message: `${assessor?.name || 'Your assessor'} created a new assessment: ${source.title || 'Untitled'}`,
      entityType: 'Assessment',
      entityId: copyId,
    });

    return NextResponse.json({ success: true, data: { _id: copyId } }, { status: 201 });
  } catch (err) {
    console.error('Error duplicating assessment:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
